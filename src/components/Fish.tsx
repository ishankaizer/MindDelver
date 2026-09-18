import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SPECIES } from '../lib/fish'
import { reefLibrary } from '../lib/reefLibrary'
import { FLOOR_Y, rng } from '../lib/sea'

/**
 * The fish are billboards on lazy orbits rather than anything that steers.
 * Real boids would be invisible at this scale and this distance; what actually
 * reads is a shoal crossing behind the coral at one speed while a lone fish
 * drifts past in front at another, so that is what is built.
 *
 * All of it runs in the vertex shader. Each fish is a handful of orbit numbers
 * uploaded once, and its position, its facing, and which of its two frames is
 * showing are all derived from the clock on the GPU. That means a hundred fish
 * cost one draw call and no per-frame JavaScript at all, where the obvious
 * implementation - a mesh each, a matrix written from an update loop - costs a
 * hundred of both.
 */

const VERT = /* glsl */ `
  uniform float uTime;

  attribute vec4 aOrbit;   // radius, height, angular speed, phase
  attribute vec4 aWobble;  // angle offset, radius offset, height offset, personal phase
  attribute vec4 aFrame;   // atlas rect of this species' two-frame strip
  attribute vec3 aMeta;    // width, height, tail beat

  varying vec2 vUv;
  varying float vFogDepth;

  void main() {
    float phase = aWobble.w;
    float angle = aOrbit.w + uTime * aOrbit.z + aWobble.x;
    float radius = aOrbit.x + aWobble.y + sin(uTime * 0.37 + phase) * 0.8;

    vec3 centre = vec3(
      cos(angle) * radius,
      aOrbit.y + aWobble.z + sin(uTime * 0.63 + phase) * 0.7,
      sin(angle) * radius
    );

    vec3 toCam = cameraPosition - centre;
    vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x));

    // face the way it is going, judged against the camera's own right. This is
    // the one thing that separates a swimming fish from a sticker sliding
    // sideways, and it has to be re-decided as the camera orbits
    vec3 heading = vec3(-sin(angle), 0.0, cos(angle)) * sign(aOrbit.z);
    float facing = dot(heading, right) > 0.0 ? 1.0 : -1.0;

    vec3 world = centre
      + right * (position.x * aMeta.x * facing)
      + vec3(0.0, position.y * aMeta.y, 0.0);

    // two frames on one strip: the tail flicks between them on its own beat
    float frame = mod(floor(uTime * aMeta.z + phase), 2.0);
    vUv = aFrame.xy + vec2((uv.x * 0.5 + frame * 0.5) * aFrame.z, uv.y * aFrame.w);

    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 fogColor;
  uniform float fogDensity;

  varying vec2 vUv;
  varying float vFogDepth;

  void main() {
    vec4 texel = texture2D(uAtlas, vUv);
    if (texel.a < 0.5) discard;
    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    gl_FragColor = vec4(mix(texel.rgb, fogColor, clamp(fogFactor, 0.0, 1.0)), 1.0);
  }
`

const SHOALS = 6
const LONERS = 10

export function Fish() {
  const material = useRef<THREE.ShaderMaterial>(null)
  const library = reefLibrary()

  const geometry = useMemo(() => {
    const rand = rng(90210)

    type Ring = { radius: number; y: number; speed: number; phase: number }
    const rings: Ring[] = []
    for (let i = 0; i < SHOALS; i++) {
      rings.push({
        radius: 11 + rand() * 19,
        y: FLOOR_Y + 3 + rand() * 17,
        speed: (0.055 + rand() * 0.07) * (rand() < 0.5 ? -1 : 1),
        phase: rand() * Math.PI * 2,
      })
    }
    for (let i = 0; i < LONERS; i++) {
      rings.push({
        radius: 12 + rand() * 26,
        y: FLOOR_Y + 2 + rand() * 21,
        speed: (0.03 + rand() * 0.05) * (rand() < 0.5 ? -1 : 1),
        phase: rand() * Math.PI * 2,
      })
    }

    type Swimmer = { ring: number; species: number; size: number; wobble: [number, number, number, number]; beat: number }
    const swimmers: Swimmer[] = []

    // sizes are judged against the coral, not against a real fish: anything
    // scaled honestly beside a twelve-metre sculpture would be one pixel
    for (let r = 0; r < SHOALS; r++) {
      // a shoal is one species: mixed colours in a tight group read as confetti
      const species = Math.floor(rand() * SPECIES.length)
      const members = 9 + Math.floor(rand() * 9)
      for (let i = 0; i < members; i++) {
        swimmers.push({
          ring: r,
          species,
          size: 0.4 + rand() * 0.24,
          wobble: [
            (rand() - 0.5) * 0.5,
            (rand() - 0.5) * 4.5,
            (rand() - 0.5) * 3.2,
            rand() * Math.PI * 2,
          ],
          beat: 5 + rand() * 3,
        })
      }
    }
    for (let r = SHOALS; r < rings.length; r++) {
      swimmers.push({
        ring: r,
        species: Math.floor(rand() * SPECIES.length),
        size: 0.72 + rand() * 0.45,
        wobble: [0, 0, 0, rand() * Math.PI * 2],
        beat: 3.4 + rand() * 2,
      })
    }

    const count = swimmers.length
    const orbit = new Float32Array(count * 4)
    const wobble = new Float32Array(count * 4)
    const frame = new Float32Array(count * 4)
    const meta = new Float32Array(count * 3)

    swimmers.forEach((fish, i) => {
      const ring = rings[fish.ring]
      const f = library.atlas.frames[library.fish[fish.species]]
      orbit[i * 4] = ring.radius
      orbit[i * 4 + 1] = ring.y
      orbit[i * 4 + 2] = ring.speed
      orbit[i * 4 + 3] = ring.phase
      wobble.set(fish.wobble, i * 4)
      frame[i * 4] = f.u
      frame[i * 4 + 1] = f.v
      frame[i * 4 + 2] = f.w
      frame[i * 4 + 3] = f.h
      meta[i * 3] = fish.size * f.aspect
      meta[i * 3 + 1] = fish.size
      meta[i * 3 + 2] = fish.beat
    })

    const plane = new THREE.PlaneGeometry(1, 1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = plane.index
    geo.setAttribute('position', plane.attributes.position)
    geo.setAttribute('uv', plane.attributes.uv)
    plane.dispose()
    geo.setAttribute('aOrbit', new THREE.InstancedBufferAttribute(orbit, 4))
    geo.setAttribute('aWobble', new THREE.InstancedBufferAttribute(wobble, 4))
    geo.setAttribute('aFrame', new THREE.InstancedBufferAttribute(frame, 4))
    geo.setAttribute('aMeta', new THREE.InstancedBufferAttribute(meta, 3))
    geo.instanceCount = count
    return geo
  }, [library])

  useEffect(() => () => geometry.dispose(), [geometry])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAtlas: { value: library.atlas.texture },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    }),
    [library],
  )

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    // the shoals swim right around the camera, so there is never a frame where
    // culling the whole shoal is correct, and the positions live on the GPU
    // where the bounding box cannot see them anyway
    <mesh geometry={geometry} frustumCulled={false} raycast={() => null}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        fog
      />
    </mesh>
  )
}

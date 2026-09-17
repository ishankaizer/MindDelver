import { useMemo, useRef } from 'react'
import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SEA } from '../lib/sea'

/**
 * The water itself. Everything here is distant: a depth gradient, the lit
 * ceiling you are hanging under, and the shafts coming through it. Nothing in
 * this file has a position you can swim to, which is why it is painted on the
 * inside of one large sphere rather than modelled.
 */
const BACKDROP_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const BACKDROP_FRAG = /* glsl */ `
  uniform vec3 uSurface;
  uniform vec3 uShallow;
  uniform vec3 uMid;
  uniform vec3 uDeep;
  uniform vec3 uTrench;
  uniform float uTime;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y * 0.5 + 0.5;

    // four stops, weighted toward the bottom half: under water almost all of
    // the readable gradient happens below you, and an even ramp wastes it
    vec3 col = mix(uTrench, uDeep, smoothstep(0.0, 0.22, h));
    col = mix(col, uMid, smoothstep(0.18, 0.48, h));
    col = mix(col, uShallow, smoothstep(0.46, 0.82, h));
    col = mix(col, uSurface, smoothstep(0.84, 1.0, h));

    // the ceiling, breaking into ripples where the two sine fields cross
    float ripple = sin(dir.x * 13.0 + uTime * 0.42) * sin(dir.z * 9.5 - uTime * 0.31);
    float ceiling = smoothstep(0.80, 1.0, h);
    col += uSurface * ceiling * (0.22 + ripple * 0.26);

    // shafts. Harmonics on the azimuth raised to a high power, so what
    // survives is a narrow blade rather than a wave, all of it keyed to height
    // so the rays die out long before the floor.
    float azim = atan(dir.z, dir.x);
    float rays = pow(max(0.0, sin(azim * 5.0 + uTime * 0.045)), 24.0);
    rays += pow(max(0.0, sin(azim * 3.0 - uTime * 0.031 + 1.7)), 15.0) * 0.75;
    rays += pow(max(0.0, sin(azim * 8.0 + uTime * 0.062 + 3.1)), 34.0) * 0.55;
    rays += pow(max(0.0, sin(azim * 11.0 - uTime * 0.05 + 5.4)), 40.0) * 0.4;
    col += uSurface * rays * smoothstep(-0.25, 0.95, dir.y) * 0.42;

    // a dark gradient across a wide canvas bands badly without this, and the
    // banding the pixel pass adds later has to be the only banding on screen
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) * 0.008;

    gl_FragColor = vec4(col, 1.0);
  }
`

function Backdrop() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uSurface: { value: new THREE.Color(SEA.shallow) },
      uShallow: { value: new THREE.Color(SEA.cyan) },
      uMid: { value: new THREE.Color(SEA.deep) },
      uDeep: { value: new THREE.Color(SEA.night) },
      uTrench: { value: new THREE.Color(SEA.abyss) },
      uTime: { value: 0 },
    }),
    [],
  )

  useFrame(({ clock }) => {
    if (materialRef.current) materialRef.current.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <mesh renderOrder={-1} frustumCulled={false} raycast={() => null}>
      <sphereGeometry args={[150, 40, 28]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={BACKDROP_VERT}
        fragmentShader={BACKDROP_FRAG}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  )
}

const SHAFT_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const SHAFT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;

  void main() {
    // soft along the blade and soft at both ends: a shaft with an edge reads
    // as a sheet of glass
    float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
    across = pow(smoothstep(0.0, 1.0, across), 2.4);
    float down = smoothstep(0.0, 0.45, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
    float breathe = 0.72 + 0.28 * sin(uTime * 0.35 + uSeed * 6.2);
    gl_FragColor = vec4(uColor, across * down * 0.07 * breathe);
  }
`

/**
 * Near-field light shafts, as geometry rather than painted on the backdrop.
 * The painted ones sit at infinity and never move; these sit at twenty-odd
 * metres, so orbiting slides them across the coral. That displacement is most
 * of what sells depth in the reference art.
 */
function Shafts() {
  const group = useRef<THREE.Group>(null)
  const materials = useRef<THREE.ShaderMaterial[]>([])

  const blades = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + 0.4
        const r = 30 + ((i * 7) % 5) * 7
        return {
          key: i,
          position: [Math.cos(a) * r, 9, Math.sin(a) * r] as [number, number, number],
          scale: [4 + (i % 4) * 2, 40, 1] as [number, number, number],
          seed: i / 7,
        }
      }),
    [],
  )

  useFrame(({ clock, camera }) => {
    for (const m of materials.current) {
      if (m) m.uniforms.uTime.value = clock.elapsedTime
    }
    // billboard about Y only: a shaft that tips toward the camera stops being
    // vertical, and vertical is the whole read
    if (group.current) {
      for (const child of group.current.children) {
        child.rotation.y = Math.atan2(
          camera.position.x - child.position.x,
          camera.position.z - child.position.z,
        )
      }
    }
  })

  return (
    <group ref={group}>
      {blades.map((b, i) => (
        <mesh
          key={b.key}
          position={b.position}
          scale={b.scale}
          raycast={() => null}
          renderOrder={2}
        >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            ref={(m) => {
              if (m) materials.current[i] = m as unknown as THREE.ShaderMaterial
            }}
            uniforms={{
              uColor: { value: new THREE.Color(SEA.foam) },
              uTime: { value: 0 },
              uSeed: { value: b.seed },
            }}
            vertexShader={SHAFT_VERT}
            fragmentShader={SHAFT_FRAG}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Lightformers rather than an HDRI: it keeps the whole thing offline and lets
 * the reflections be placed on purpose. Under water there is only one source
 * worth modelling, the lit ceiling, so it gets the big soft one.
 */
function Rig() {
  return (
    <Environment resolution={256} frames={1}>
      <Lightformer
        form="circle"
        intensity={3.4}
        color="#BFF4FA"
        scale={[30, 30, 1]}
        position={[0, 16, 0]}
        target={[0, 0, 0]}
      />
      <Lightformer
        form="rect"
        intensity={1.5}
        color="#4FD3E8"
        scale={[16, 12, 1]}
        position={[9, 6, 9]}
        target={[0, 0, 0]}
      />
      <Lightformer
        form="rect"
        intensity={1}
        color="#1B4E80"
        scale={[14, 10, 1]}
        position={[-11, 2, -8]}
        target={[0, 0, 0]}
      />
      {/* sand bounce, the one warm thing down here */}
      <Lightformer
        form="ring"
        intensity={0.9}
        color="#E6D5A6"
        scale={[13, 13, 1]}
        position={[0, -8, 4]}
        target={[0, 0, 0]}
      />
    </Environment>
  )
}

export function Atmosphere() {
  return (
    <>
      <Backdrop />
      <Rig />
      <Shafts />

      {/* water is not air, and the haze it adds is pale, not dark: distance
          has to lift a silhouette toward the water colour, never sink it */}
      <fogExp2 attach="fog" args={[SEA.deep, 0.01]} />
      <ambientLight intensity={0.3} color="#6FBFDC" />
      <directionalLight position={[3, 14, 4]} intensity={1.15} color="#CFF4FA" />
      <directionalLight position={[-9, -3, -7]} intensity={0.3} color="#2E6FA8" />
    </>
  )
}

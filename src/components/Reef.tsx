import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SEA, coralTexture, kelpTexture, rng, rockTexture } from '../lib/sea'

export const FLOOR_Y = -15

/**
 * The seafloor. A flat plane would read as a table, so the caustics do the
 * work: two sine fields crossed and then sharpened, which is the cheapest
 * thing that looks like light refracted through a moving surface. It is also
 * the only warm colour in the scene, which is what keeps the blue from
 * flattening into one note.
 */
const FLOOR_VERT = /* glsl */ `
  varying vec2 vXZ;
  #include <common>
  #include <fog_pars_vertex>
  void main() {
    vXZ = position.xy;
    #include <begin_vertex>
    #include <project_vertex>
    #include <fog_vertex>
  }
`

const FLOOR_FRAG = /* glsl */ `
  uniform vec3 uSand;
  uniform vec3 uShade;
  uniform vec3 uCaustic;
  uniform float uTime;
  varying vec2 vXZ;
  #include <common>
  #include <fog_pars_fragment>

  float web(vec2 p, float t) {
    float a = sin(p.x * 0.42 + t) + sin(p.y * 0.37 - t * 0.8);
    float b = sin((p.x + p.y) * 0.29 + t * 0.6) + sin((p.x - p.y) * 0.33 - t * 0.5);
    // the abs/pow pair is what turns two soft waves into bright veins
    return pow(1.0 - min(1.0, abs(a * b) * 0.5), 4.0);
  }

  void main() {
    float t = uTime * 0.28;
    float c = web(vXZ * 1.7, t) * 0.7 + web(vXZ * 3.4 + 11.0, t * 1.4) * 0.35;

    // patchy sand rather than an even field, but only just: at this distance
    // strong patches read as camouflage instead of seabed
    float mottle = sin(vXZ.x * 0.11) * sin(vXZ.y * 0.13) * 0.5 + 0.5;
    vec3 col = mix(uShade, uSand, mottle * 0.35 + 0.4);
    col += uCaustic * c * 0.3;

    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`

function Seafloor() {
  const ref = useRef<THREE.ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uSand: { value: new THREE.Color('#2A4A5E') },
      uShade: { value: new THREE.Color(SEA.abyss) },
      uCaustic: { value: new THREE.Color(SEA.shallow) },
      uTime: { value: 0 },
      ...THREE.UniformsLib.fog,
    }),
    [],
  )

  useFrame(({ clock }) => {
    if (ref.current) ref.current.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} raycast={() => null}>
      <planeGeometry args={[420, 420]} />
      <shaderMaterial
        ref={ref}
        uniforms={uniforms}
        vertexShader={FLOOR_VERT}
        fragmentShader={FLOOR_FRAG}
        fog
      />
    </mesh>
  )
}

type Card = {
  key: string
  kind: 'rock' | 'coral' | 'kelp'
  position: [number, number, number]
  scale: [number, number]
  seed: number
  sway: number
}

/**
 * One band of scenery at a fixed distance. Three of these at different radii
 * is the whole parallax trick: orbiting moves the near band across the far one
 * at a visibly different rate, which is what gives the water depth. It is the
 * same thing a side-scroller does with scrolling layers, done with real
 * distance instead of a scroll multiplier.
 */
function Band({
  radius,
  count,
  color,
  height,
  spread,
  seed,
}: {
  radius: number
  count: number
  color: string
  height: number
  spread: number
  seed: number
}) {
  const group = useRef<THREE.Group>(null)

  const textures = useMemo(() => {
    const rock = [0, 1, 2].map((i) => rockTexture(seed * 131 + i * 17))
    const coral = [0, 1, 2].map((i) => coralTexture(seed * 197 + i * 23))
    const kelp = [0, 1].map((i) => kelpTexture(seed * 271 + i * 29))
    return { rock, coral, kelp }
  }, [seed])

  useEffect(
    () => () => {
      for (const list of Object.values(textures)) for (const t of list) t.dispose()
    },
    [textures],
  )

  const cards = useMemo<Card[]>(() => {
    const rand = rng(seed * 7919 + 13)
    return Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + rand() * 0.4
      const r = radius + (rand() - 0.5) * spread
      const roll = rand()
      const kind: Card['kind'] = roll < 0.5 ? 'rock' : roll < 0.82 ? 'coral' : 'kelp'
      const h = height * (kind === 'rock' ? 1 : kind === 'kelp' ? 0.85 : 0.6) * (0.6 + rand() * 0.8)
      const w = h * (kind === 'rock' ? 1.6 : kind === 'kelp' ? 0.55 : 1.05)
      return {
        key: `${seed}-${i}`,
        kind,
        position: [Math.cos(a) * r, FLOOR_Y + h / 2 - h * 0.06, Math.sin(a) * r],
        scale: [w, h],
        seed: Math.floor(rand() * 3),
        sway: rand(),
      }
    })
  }, [radius, count, height, spread, seed])

  useFrame(({ clock, camera }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime
    g.children.forEach((child, i) => {
      child.rotation.y = Math.atan2(
        camera.position.x - child.position.x,
        camera.position.z - child.position.z,
      )
      // only the soft things move, and slowly: a swaying rock is a bouncy ball
      const card = cards[i]
      if (card && card.kind !== 'rock') {
        child.rotation.z = Math.sin(t * 0.34 + card.sway * 9) * 0.045
      }
    })
  })

  return (
    <group ref={group}>
      {cards.map((c) => (
        <mesh key={c.key} position={c.position} scale={[c.scale[0], c.scale[1], 1]} raycast={() => null}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={textures[c.kind][c.seed % textures[c.kind].length]}
            color={color}
            // alphaTest instead of transparency: a cut-out keeps the pixel edge
            // hard and keeps the depth buffer honest between overlapping cards
            alphaTest={0.5}
            side={THREE.DoubleSide}
            fog
          />
        </mesh>
      ))}
    </group>
  )
}

const DRIFT_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uRise;
  uniform float uSpan;
  uniform float uBase;
  attribute float aSeed;
  varying float vFade;

  void main() {
    vec3 p = position;
    float life = fract(aSeed + uTime * uRise);
    p.y = uBase + life * uSpan;
    // a bubble does not go straight up, and the wobble is what says "water"
    p.x += sin(uTime * 0.9 + aSeed * 31.0) * (0.35 + aSeed * 0.9);
    p.z += cos(uTime * 0.72 + aSeed * 17.0) * (0.35 + aSeed * 0.9);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (28.0 / -mv.z);
    // fade in at birth and out at the top, so nothing ever pops
    vFade = smoothstep(0.0, 0.08, life) * smoothstep(1.0, 0.72, life);
  }
`

const DRIFT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uRing;
  varying float vFade;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    // uRing pushes the brightness to the rim, which is how a bubble reads
    float body = mix(1.0 - r * 0.6, smoothstep(0.35, 1.0, r), uRing);
    gl_FragColor = vec4(uColor, body * vFade * uOpacity);
  }
`

function Drift({
  count,
  color,
  size,
  rise,
  span,
  base,
  radius,
  opacity,
  ring,
  seed,
}: {
  count: number
  color: string
  size: number
  rise: number
  span: number
  base: number
  radius: number
  opacity: number
  ring: number
  seed: number
}) {
  const ref = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const rand = rng(seed)
    const pos = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand()) * radius
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = 0
      pos[i * 3 + 2] = Math.sin(a) * r
      seeds[i] = rand()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, base + span / 2, 0), radius + span)
    return g
  }, [count, radius, seed, base, span])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock }) => {
    if (ref.current) ref.current.uniforms.uTime.value = clock.elapsedTime
  })

  return (
    <points geometry={geometry} raycast={() => null} renderOrder={3}>
      <shaderMaterial
        ref={ref}
        uniforms={{
          uTime: { value: 0 },
          uSize: { value: size },
          uRise: { value: rise },
          uSpan: { value: span },
          uBase: { value: base },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
          uRing: { value: ring },
        }}
        vertexShader={DRIFT_VERT}
        fragmentShader={DRIFT_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export function Reef() {
  return (
    <>
      <Seafloor />

      {/* near, mid, far. Each band is lighter than the one in front of it:
          under water, distance means haze, not shadow. */}
      <Band radius={36} count={10} color="#061626" height={6} spread={10} seed={3} />
      <Band radius={58} count={13} color="#0A2742" height={11} spread={15} seed={11} />
      <Band radius={94} count={18} color="#10405F" height={20} spread={26} seed={29} />

      <Drift
        count={120}
        color={SEA.foam}
        size={4.2}
        rise={0.028}
        span={38}
        base={FLOOR_Y}
        radius={19}
        opacity={0.7}
        ring={0.85}
        seed={7}
      />
      {/* marine snow: falling, not rising, and much slower */}
      <Drift
        count={220}
        color="#BFE8F2"
        size={2.1}
        rise={-0.008}
        span={44}
        base={FLOOR_Y}
        radius={40}
        opacity={0.36}
        ring={0}
        seed={19}
      />
    </>
  )
}

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FLOOR_Y, SEA, rng } from '../lib/sea'
import { reefLibrary } from '../lib/reefLibrary'
import { SOFT, SPRITE_HEIGHT, type SpriteKind } from '../lib/sprites'
import { Fish } from './Fish'
import { ReefField, type Piece } from './ReefField'

export { FLOOR_Y }

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

/**
 * Mounds are the one part of the seabed that is real geometry rather than a
 * card, and being lit and solid is exactly the point: a billboard cannot tell
 * you the ground is not flat, and without that the reef sits on a sheet of
 * glass. One instanced mesh, so thirty-four of them still cost one call.
 */
const MOUND_COUNT = 34

function Mounds() {
  const ref = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const rand = rng(4457)
    // stone, not water. These used to be deep blues, and the palette can only
    // say a deep blue as water: every mound quantised onto a water swatch and
    // the ground the reef stands on came back as a patch of murk. The darker
    // half of the stone ramp keeps them reading as rock while staying behind
    // the sprites standing on them.
    const tones = ['#4a5560', '#424f5b', '#55605e', '#3b4852', '#4e5a57']
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const position = new THREE.Vector3()
    const scale = new THREE.Vector3()
    const color = new THREE.Color()

    for (let i = 0; i < MOUND_COUNT; i++) {
      const a = (i / MOUND_COUNT) * Math.PI * 2 + rand() * 0.8
      const r = 11 + Math.sqrt(rand()) * 46
      const w = 3.5 + rand() * 7
      const h = 1.8 + rand() * 4
      euler.set(rand() * 0.3, rand() * Math.PI, rand() * 0.3)
      position.set(Math.cos(a) * r, FLOOR_Y - h * 0.35, Math.sin(a) * r)
      scale.set(w, h, w * (0.7 + rand() * 0.6))
      matrix.compose(position, quaternion.setFromEuler(euler), scale)
      mesh.setMatrixAt(i, matrix)
      mesh.setColorAt(i, color.set(tones[Math.floor(rand() * tones.length)]))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MOUND_COUNT]} raycast={() => null}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial roughness={0.96} metalness={0} flatShading />
    </instancedMesh>
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

/** Weighted draws, so a thicket comes out mostly coral and a meadow mostly grass. */
type Mix = [SpriteKind, number][]

const THICKET: Mix = [
  ['staghorn', 10],
  ['brain', 6],
  ['table', 6],
  ['fan', 8],
  ['tube', 7],
  ['barrel', 5],
  ['bubble', 6],
  ['polyps', 7],
  ['toadstool', 6],
  ['anemone', 7],
  ['seaweed', 6],
  ['seagrass', 6],
  ['kelp', 5],
  ['rock', 7],
  ['boulder', 6],
]

const MEADOW: Mix = [
  ['grass', 30],
  ['seagrass', 7],
  ['seaweed', 2],
  ['star', 1],
  ['shell', 1],
]

const TRINKETS: Mix = [
  ['star', 3],
  ['shell', 3],
  ['urchin', 3],
  ['clam', 2],
  ['polyps', 2],
]

/** The distance bands read as a skyline: only shapes that survive at that size. */
const BAND: Mix = [
  ['rock', 10],
  ['boulder', 7],
  ['staghorn', 7],
  ['fan', 6],
  ['kelp', 7],
  ['forest', 5],
  ['tube', 5],
  ['brain', 4],
  ['table', 4],
  ['spire', 3],
]

const SKYLINE: Mix = [
  ['ridge', 10],
  ['spire', 8],
  ['forest', 7],
  ['rock', 6],
  ['kelp', 4],
  ['staghorn', 3],
]

function draw(mix: Mix, rand: () => number): SpriteKind {
  const total = mix.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = rand() * total
  for (const [kind, weight] of mix) {
    roll -= weight
    if (roll <= 0) return kind
  }
  return mix[0][0]
}

type Layer = {
  mix: Mix
  count: number
  inner: number
  outer: number
  /** how many thickets this layer grows around */
  clusters: number
  /** how far a piece can sit from its thicket's centre */
  spread: number
  /** multiplier range on each kind's natural height */
  scale: [number, number]
  tint: string
  silhouette?: boolean
  sway?: number
}

/**
 * Colonies crowd onto whatever hard ground they can reach and leave open sand
 * between, so everything grows around a set of centres rather than being
 * sprayed evenly. An even spread is the one distribution a reef never has: it
 * reads as a lawn, and the gaps between thickets are what make density feel
 * placed rather than generated.
 */
function scatter(seed: number, layers: Layer[]): Piece[] {
  const lib = reefLibrary()
  const rand = rng(seed)
  const pieces: Piece[] = []
  const tints = new Map<string, THREE.Color>()

  for (const layer of layers) {
    let tint = tints.get(layer.tint)
    if (!tint) {
      tint = new THREE.Color(layer.tint)
      tints.set(layer.tint, tint)
    }

    const centres = Array.from({ length: layer.clusters }, () => ({
      angle: rand() * Math.PI * 2,
      radius: layer.inner + Math.sqrt(rand()) * (layer.outer - layer.inner),
    }))

    for (let i = 0; i < layer.count; i++) {
      const centre = centres[Math.floor(rand() * centres.length)]
      const off = rand() * Math.PI * 2
      const reach = Math.sqrt(rand()) * layer.spread
      const radius = Math.max(layer.inner * 0.8, centre.radius + Math.cos(off) * reach)
      const angle = centre.angle + (Math.sin(off) * reach) / Math.max(1, radius)

      const kind = draw(layer.mix, rand)
      const frames = lib.frames[kind]
      const [lo, hi] = SPRITE_HEIGHT[kind]
      const spread = layer.scale[1] - layer.scale[0]
      const height = (lo + rand() * (hi - lo)) * (layer.scale[0] + rand() * spread)

      pieces.push({
        position: [Math.cos(angle) * radius, FLOOR_Y - height * 0.04, Math.sin(angle) * radius],
        frame: frames[Math.floor(rand() * frames.length)],
        height,
        flip: rand() < 0.5,
        sway: rand(),
        swayAmount: SOFT.has(kind) ? (layer.sway ?? 0.05) : 0,
        tint,
        silhouette: layer.silhouette,
      })
    }
  }

  return pieces
}

const FIELD_RADIUS = 170

export function Reef() {
  const library = reefLibrary()

  const pieces = useMemo(
    () =>
      scatter(8123, [
        // the meadow goes down first: broad beds of grass for everything else
        // to stand in, rather than bare sand with things dotted on it
        {
          mix: MEADOW,
          count: 520,
          inner: 6,
          outer: 40,
          clusters: 14,
          spread: 9,
          scale: [0.8, 1.5],
          tint: '#FFFFFF',
          sway: 0.09,
        },
        {
          mix: THICKET,
          count: 300,
          inner: 6,
          outer: 34,
          clusters: 20,
          spread: 5,
          scale: [0.8, 1.35],
          tint: '#FFFFFF',
        },
        {
          mix: TRINKETS,
          count: 80,
          inner: 6,
          outer: 34,
          clusters: 22,
          spread: 6,
          scale: [0.9, 1.4],
          tint: '#FFFFFF',
        },
        {
          mix: THICKET,
          count: 130,
          inner: 34,
          outer: 52,
          clusters: 16,
          spread: 8,
          scale: [1.3, 2.2],
          tint: '#EAF4F9',
        },
        {
          mix: BAND,
          count: 120,
          inner: 52,
          outer: 78,
          clusters: 14,
          spread: 11,
          scale: [1.8, 3.2],
          tint: '#D2E6F1',
        },
        // the shadowy far shapes. Two rings, the nearer one darker, so the haze
        // between them reads as distance instead of as one flat backdrop
        {
          mix: SKYLINE,
          count: 54,
          inner: 84,
          outer: 112,
          clusters: 11,
          spread: 16,
          scale: [1.0, 1.9],
          tint: '#0A2740',
          silhouette: true,
        },
        {
          mix: SKYLINE,
          count: 40,
          inner: 118,
          outer: 146,
          clusters: 9,
          spread: 20,
          scale: [1.6, 2.8],
          tint: '#0E3355',
          silhouette: true,
        },
      ]),
    [],
  )

  return (
    <>
      <Seafloor />
      <Mounds />

      <ReefField pieces={pieces} atlas={library.atlas} radius={FIELD_RADIUS} />
      <Fish />

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

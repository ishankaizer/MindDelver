import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { FLOOR_Y, SEA, rng } from '../lib/sea'
import { SOFT, SPRITE_HEIGHT, type Sprite, type SpriteKind, reefSprite } from '../lib/sprites'
import { Fish } from './Fish'

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
 * glass. They also give the cards something to stand on and hide behind.
 */
function Mounds() {
  const mounds = useMemo(() => {
    const rand = rng(4457)
    // kept close to the floor shader's own sand, and never wider than they are
    // tall by much: a broad flat dome catches the key light across its whole
    // top and reads as a puddle of light rather than as ground
    const tones = ['#24455A', '#1E3F52', '#2B506A', '#1A3849']
    return Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2 + rand() * 0.7
      const r = 13 + rand() * 28
      const w = 3.5 + rand() * 5
      const h = 2 + rand() * 3.4
      return {
        key: i,
        position: [Math.cos(a) * r, FLOOR_Y - h * 0.35, Math.sin(a) * r] as [number, number, number],
        scale: [w, h, w * (0.7 + rand() * 0.6)] as [number, number, number],
        rotation: [rand() * 0.3, rand() * Math.PI, rand() * 0.3] as [number, number, number],
        color: tones[Math.floor(rand() * tones.length)],
      }
    })
  }, [])

  return (
    <>
      {mounds.map((m) => (
        <mesh
          key={m.key}
          position={m.position}
          scale={m.scale}
          rotation={m.rotation}
          raycast={() => null}
        >
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={m.color} roughness={0.96} metalness={0} flatShading />
        </mesh>
      ))}
    </>
  )
}

type Spot = { angle: number; radius: number; scale: number }

/**
 * Reef life clumps. Scattering evenly over a ring gives a lawn, and a lawn is
 * the thing a reef is least like: colonies crowd onto whatever hard ground
 * they can get and leave open sand between. So placement picks a dozen
 * thickets and grows everything around those.
 */
function clumpSpots(seed: number, count: number, inner: number, outer: number): Spot[] {
  const rand = rng(seed)
  const centres = Array.from({ length: 17 }, () => ({
    angle: rand() * Math.PI * 2,
    radius: inner + Math.sqrt(rand()) * (outer - inner),
  }))
  return Array.from({ length: count }, () => {
    const c = centres[Math.floor(rand() * centres.length)]
    const spread = 2.2 + rand() * 3.6
    const off = rand() * Math.PI * 2
    const radius = Math.max(inner * 0.85, c.radius + Math.cos(off) * spread)
    return {
      angle: c.angle + (Math.sin(off) * spread) / radius,
      radius,
      scale: 0.8 + rand() * 0.5,
    }
  })
}

/** An even ring, which is what the distance bands want: a horizon, not clumps. */
function ringSpots(seed: number, count: number, radius: number, spread: number): Spot[] {
  const rand = rng(seed)
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2 + rand() * 0.4,
    radius: radius + (rand() - 0.5) * spread,
    scale: 1.4 + rand() * 1.1,
  }))
}

type Card = {
  key: string
  kind: SpriteKind
  index: number
  position: [number, number, number]
  height: number
  flip: number
  sway: number
}

type Patch = { sprites: Sprite[]; cards: Card[] }

/**
 * Builds a sprite set and the cards that use it. Sprites are shared across
 * every card that references them, so a hundred pieces of reef cost a couple
 * of dozen small canvases rather than a hundred.
 */
function buildPatch(
  seed: number,
  kinds: readonly SpriteKind[],
  variants: number,
  spots: Spot[],
): Patch {
  const rand = rng(seed * 7919 + 13)
  const sprites: Sprite[] = []
  const byKind = new Map<SpriteKind, number[]>()
  kinds.forEach((kind, k) => {
    const list: number[] = []
    for (let v = 0; v < variants; v++) {
      list.push(sprites.length)
      sprites.push(reefSprite(kind, seed * 977 + k * 131 + v * 17))
    }
    byKind.set(kind, list)
  })

  const cards = spots.map((spot, i) => {
    const kind = kinds[Math.floor(rand() * kinds.length)]
    const list = byKind.get(kind)!
    const [lo, hi] = SPRITE_HEIGHT[kind]
    const height = (lo + rand() * (hi - lo)) * spot.scale
    return {
      key: `${seed}-${i}`,
      kind,
      index: list[Math.floor(rand() * list.length)],
      position: [
        Math.cos(spot.angle) * spot.radius,
        FLOOR_Y + height / 2 - height * 0.06,
        Math.sin(spot.angle) * spot.radius,
      ] as [number, number, number],
      height,
      flip: rand() < 0.5 ? -1 : 1,
      sway: rand(),
    }
  })

  return { sprites, cards }
}

/** Cards standing on the sand, billboarded around Y and swaying if they are soft. */
function Scatter({
  patch,
  tint,
  sway = 0.05,
}: {
  patch: Patch
  tint: string
  sway?: number
}) {
  const group = useRef<THREE.Group>(null)
  const { cards, sprites } = patch

  useEffect(
    () => () => {
      for (const s of sprites) s.texture.dispose()
    },
    [sprites],
  )

  useFrame(({ clock, camera }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime
    for (let i = 0; i < cards.length; i++) {
      const child = g.children[i]
      const card = cards[i]
      if (!child) continue
      child.rotation.y = Math.atan2(
        camera.position.x - child.position.x,
        camera.position.z - child.position.z,
      )
      // only the soft things move, and slowly: a swaying rock is a bouncy ball
      if (SOFT.has(card.kind)) child.rotation.z = Math.sin(t * 0.34 + card.sway * 9) * sway
    }
  })

  return (
    <group ref={group}>
      {cards.map((c) => {
        const sprite = sprites[c.index]
        return (
          <mesh
            key={c.key}
            position={c.position}
            scale={[c.height * sprite.aspect * c.flip, c.height, 1]}
            raycast={() => null}
          >
            <planeGeometry args={[1, 1]} />
            <meshBasicMaterial
              map={sprite.texture}
              color={tint}
              // alphaTest instead of transparency: a cut-out keeps the pixel edge
              // hard and keeps the depth buffer honest between overlapping cards
              alphaTest={0.5}
              side={THREE.DoubleSide}
              fog
            />
          </mesh>
        )
      })}
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

const GARDEN_KINDS: SpriteKind[] = [
  'staghorn',
  'brain',
  'table',
  'fan',
  'tube',
  'barrel',
  'bubble',
  'polyps',
  'toadstool',
  'anemone',
  'seagrass',
  'kelp',
  'rock',
  'boulder',
]

const TRINKET_KINDS: SpriteKind[] = ['star', 'shell', 'urchin', 'clam']

/** The bands are read as a skyline, so only shapes that survive at that size. */
const BAND_KINDS: SpriteKind[] = ['rock', 'boulder', 'staghorn', 'fan', 'kelp', 'tube', 'brain', 'table']

export function Reef() {
  const garden = useMemo(() => buildPatch(31, GARDEN_KINDS, 3, clumpSpots(8123, 96, 6, 32)), [])
  const trinkets = useMemo(() => buildPatch(53, TRINKET_KINDS, 2, clumpSpots(5519, 30, 6, 30)), [])
  const near = useMemo(() => buildPatch(3, BAND_KINDS, 2, ringSpots(101, 11, 36, 10)), [])
  const mid = useMemo(() => buildPatch(11, BAND_KINDS, 2, ringSpots(211, 14, 58, 15)), [])
  const far = useMemo(() => buildPatch(29, BAND_KINDS, 2, ringSpots(307, 20, 94, 26)), [])

  return (
    <>
      <Seafloor />
      <Mounds />

      {/* the garden is close enough to keep its own colour; nothing is tinted
          away from what the sprite generator chose */}
      <Scatter patch={garden} tint="#FFFFFF" sway={0.06} />
      <Scatter patch={trinkets} tint="#FFFFFF" />

      {/* near, mid, far. The tint only cools each band slightly; the fog does
          the real distance work. Tinting hard turns the bands black instead of
          hazy, because a colour multiply can only ever darken, and under water
          distance means haze and lost colour, not shadow. */}
      <Scatter patch={near} tint="#E4F0F6" sway={0.04} />
      <Scatter patch={mid} tint="#C6DDEA" sway={0.03} />
      <Scatter patch={far} tint="#AECEE0" sway={0.02} />

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

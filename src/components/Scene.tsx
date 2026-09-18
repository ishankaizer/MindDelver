import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { deconflictLabels } from '../lib/labels'
import { createRimMaterial } from '../lib/rim'
import { SEA, rng } from '../lib/sea'
import { PIXEL_GRADES, SEED_ID, useGraph, worldPosition } from '../store/useGraph'
import { Atmosphere } from './Atmosphere'
import { FLOOR_Y, Reef } from './Reef'
import { Limb } from './Limb'
import { FusionLayer } from './FusionLayer'
import { Pixelate } from './PixelPass'

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

type Controls = { target: THREE.Vector3; update: () => void } | null

/** Keeps the whole coral in frame for a moment after it grows, then gives control back. */
function AutoFrame() {
  const nodes = useGraph((s) => s.nodes)
  const controls = useThree((s) => s.controls) as unknown as Controls
  const camera = useThree((s) => s.camera)
  const untilRef = useRef(0)

  const fit = useMemo(() => {
    const ids = Object.keys(nodes)
    if (ids.length === 0) return { center: new THREE.Vector3(0, 6, 0), radius: 5 }
    const box = new THREE.Box3().setFromPoints(ids.map((id) => worldPosition(nodes, id)))
    const center = box.getCenter(new THREE.Vector3())
    const radius = Math.max(4.5, box.getSize(new THREE.Vector3()).length() / 2)
    return { center, radius }
  }, [nodes])

  useEffect(() => {
    untilRef.current = performance.now() + 1700
  }, [fit])

  useFrame(() => {
    if (!controls || performance.now() > untilRef.current) return
    controls.target.lerp(fit.center, 0.035)
    const offset = camera.position.clone().sub(controls.target)
    const want = fit.radius * 1.95 + 4
    offset.setLength(THREE.MathUtils.lerp(offset.length(), want, 0.035))
    camera.position.copy(controls.target).add(offset)
    controls.update()
  })

  return null
}

const Y_AXIS = new THREE.Vector3(0, 1, 0)

/**
 * Before a brief is planted there is nothing to look at but the seed, so the
 * camera drifts. It is the difference between opening a still image and
 * opening somewhere that was already running before you got there.
 */
function IdleDrift() {
  const planted = useGraph((s) => s.brief.length > 0)
  const controls = useThree((s) => s.controls) as unknown as Controls
  const camera = useThree((s) => s.camera)
  const reduced = usePrefersReducedMotion()
  const offset = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    if (planted || reduced || !controls) return
    offset.copy(camera.position).sub(controls.target)
    offset.applyAxisAngle(Y_AXIS, Math.min(delta, 0.05) * 0.05)
    camera.position.copy(controls.target).add(offset)
    controls.update()
  })

  return null
}

/**
 * The rock the whole thing is anchored to, so the coral is not floating.
 *
 * It has to span the whole drop from the seed down to the sand, which is a
 * long way, and a single tapered cylinder covers that distance by reading as a
 * machined pillar. So it is stacked out of flat-shaded chunks instead, each one
 * turned and offset off the axis: the silhouette breaks up and the thing reads
 * as a spire the reef grew on.
 *
 * The tones come out of the palette's stone ramp, which is the whole trick. It
 * used to be painted a deep blue, and a deep blue is a colour the palette can
 * only say as water: the pixel pass quantised every face of it onto a water
 * swatch and the rock came back as a hole cut out of the reef. Lit stone has to
 * be given stone to land on. The chunks are also flattened rather than round,
 * because the key light is overhead - upward-facing faces are the only ones
 * that catch it, and a stack of spheres presents almost none of them.
 */
const SPIRE_TONES = ['#8a8a78', '#7b8071', '#6c7468', '#5d6a60']

function Pedestal() {
  const chunks = useMemo(() => {
    const top = -0.6
    const rand = rng(911)
    const out: {
      position: [number, number, number]
      rotation: [number, number, number]
      scale: [number, number, number]
      color: string
    }[] = []

    const count = 9
    for (let i = 0; i < count; i++) {
      // t runs 0 at the sand to 1 at the seed, so the stack tapers upward
      const t = i / (count - 1)
      const y = FLOOR_Y + (top - FLOOR_Y) * t
      const width = 3.1 - t * 1.7
      // the lean is small and grows with height: enough to break the axis,
      // not enough to look like it is falling over
      const lean = t * 0.55
      // flat enough to catch the overhead key, deep enough that consecutive
      // chunks still overlap and the stack reads as one rock rather than a pile
      const squash = 0.62 + rand() * 0.16
      out.push({
        position: [Math.cos(i * 2.4) * lean, y, Math.sin(i * 2.4) * lean],
        rotation: [rand() * 0.4 - 0.2, rand() * Math.PI, rand() * 0.4 - 0.2],
        scale: [width, width * squash, width * (0.82 + rand() * 0.4)],
        color: SPIRE_TONES[i % SPIRE_TONES.length],
      })
    }
    return out
  }, [])

  return (
    <group raycast={() => null}>
      {chunks.map((chunk, i) => (
        <mesh
          key={i}
          position={chunk.position}
          rotation={chunk.rotation}
          scale={chunk.scale}
          raycast={() => null}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color={chunk.color} roughness={0.95} metalness={0} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** The brief itself: a bioluminescent core the reef has grown around. */
function SeedCore() {
  const ref = useRef<THREE.Mesh>(null)
  const lightRef = useRef<THREE.PointLight>(null)

  const rim = useMemo(
    () => createRimMaterial({ color: SEA.shallow, strength: 1.9, power: 2, falloff: 0.62 }),
    [],
  )

  useEffect(() => () => rim.dispose(), [rim])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const m = ref.current
    if (m) {
      m.rotation.y = t * 0.12
      m.rotation.x = Math.sin(t * 0.21) * 0.12
      m.scale.setScalar(1 + Math.sin(t * 1.1) * 0.03)
    }
    // bioluminescence pulses rather than glowing steadily
    if (lightRef.current) lightRef.current.intensity = 9 + Math.sin(t * 1.35) * 3
    rim.uniforms.uStrength.value = 1.9 + Math.sin(t * 1.1) * 0.45
  })

  return (
    <group>
      <Pedestal />
      <mesh ref={ref}>
        <icosahedronGeometry args={[0.52, 2]} />
        <meshPhysicalMaterial
          color="#E8FBFF"
          emissive={SEA.shallow}
          emissiveIntensity={0.55}
          roughness={0.24}
          metalness={0.1}
          clearcoat={0.8}
          envMapIntensity={1.3}
          flatShading
        />
      </mesh>
      <mesh material={rim} raycast={() => null}>
        <icosahedronGeometry args={[0.72, 3]} />
      </mesh>
      <pointLight ref={lightRef} color="#8FEAF7" intensity={9} distance={16} decay={2} />
    </group>
  )
}

/** Runs last in the frame, once the labels have written their transforms. */
function LabelDeconflict() {
  const tick = useRef(0)
  useFrame(() => {
    tick.current += 1
    // every other frame is plenty, and it halves the layout reads
    if (tick.current % 2 === 0) deconflictLabels()
  })
  return null
}

const NO_IDS: string[] = []

export function Scene() {
  const rootIds = useGraph((s) => s.nodes[SEED_ID]?.childIds) ?? NO_IDS
  const grade = useGraph((s) => PIXEL_GRADES[s.pixelGrade])

  return (
    <>
      <color attach="background" args={[SEA.trench]} />
      <Atmosphere />
      <Reef />

      <SeedCore />
      {rootIds.map((id) => (
        <Limb key={id} id={id} />
      ))}
      <FusionLayer />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.07}
        target={[0, 6, 0]}
        minDistance={4}
        maxDistance={70}
        rotateSpeed={0.7}
        // one finger swims, exactly like a mouse drag; two fingers pinch to
        // dolly and pan at once, since a phone has no separate right-drag
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        // the coral grows upward, so looking up at it is the natural read;
        // the stop is there to keep the camera out of the seabed
        maxPolarAngle={Math.PI * 0.62}
      />
      <AutoFrame />
      <IdleDrift />
      <LabelDeconflict />

      <EffectComposer multisampling={2}>
        <Bloom
          mipmapBlur
          luminanceThreshold={0.62}
          luminanceSmoothing={0.26}
          intensity={0.5}
          radius={0.7}
        />
        {/* the composer forces NoToneMapping on the renderer, so the mapping
            has to happen here or the highlights blow out */}
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        <Vignette offset={0.5} darkness={0.34} />
        {/* last, always: the point is to grid the finished frame, glow included */}
        <Pixelate
          pixel={grade.pixel}
          palette={grade.palette}
          dither={grade.dither}
          saturation={grade.saturation}
        />
      </EffectComposer>
    </>
  )
}

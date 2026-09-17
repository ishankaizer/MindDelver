import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { createRimMaterial } from '../lib/rim'
import { useGraph, worldPosition, type FusionBlob } from '../store/useGraph'

function Thread({
  from,
  to,
  color,
  dashed,
}: {
  from: THREE.Vector3
  to: THREE.Vector3
  color: string
  dashed?: boolean
}) {
  const mid = from.clone().lerp(to, 0.5)
  mid.y += from.distanceTo(to) * 0.16
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to)
  return (
    <Line
      points={curve.getPoints(28)}
      color={color}
      lineWidth={1.4}
      transparent
      opacity={0.6}
      dashed={dashed}
      dashSize={0.22}
      gapSize={0.16}
    />
  )
}

function Fusion({ blob }: { blob: FusionBlob }) {
  const nodes = useGraph((s) => s.nodes)
  const dismiss = useGraph((s) => s.dismissFusion)
  const plantFrom = useGraph((s) => s.plantFrom)
  const coreRef = useRef<THREE.Group>(null)

  const accent = blob.provisional ? '#8C8579' : '#F3C969'

  // the crossing is the payoff of the whole loop, so it gets the best material
  // in the scene rather than the default one
  const rim = useMemo(
    () => createRimMaterial({ color: accent, strength: 1.8, power: 2.2, falloff: 0.6 }),
    [accent],
  )
  useEffect(() => () => rim.dispose(), [rim])

  useFrame(({ clock }) => {
    const m = coreRef.current
    if (!m) return
    const age = (performance.now() - blob.born) / 700
    const birth = Math.min(1, age)
    m.rotation.y = clock.elapsedTime * 0.4
    m.rotation.x = clock.elapsedTime * 0.22
    m.scale.setScalar(birth * (1 + Math.sin(clock.elapsedTime * 2.2) * 0.06))
    rim.uniforms.uStrength.value = 1.6 + Math.sin(clock.elapsedTime * 2.2) * 0.5
  })

  return (
    <group>
      {blob.parentIds.map((pid) => {
        const p = nodes[pid]
        if (!p) return null
        return (
          <Thread
            key={pid}
            from={worldPosition(nodes, pid)}
            to={blob.position}
            color={accent}
            dashed
          />
        )
      })}

      <group position={blob.position}>
        <group ref={coreRef} scale={0}>
          <mesh>
            <icosahedronGeometry args={[0.44, 0]} />
            <meshPhysicalMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={0.45}
              roughness={0.2}
              metalness={0.16}
              clearcoat={0.85}
              clearcoatRoughness={0.14}
              envMapIntensity={1.5}
              flatShading
            />
          </mesh>
          <mesh material={rim} raycast={() => null}>
            <icosahedronGeometry args={[0.6, 2]} />
          </mesh>
          <pointLight color={accent} intensity={5} distance={11} decay={2} />
        </group>
        <Html position={[0, 1.35, 0]} center zIndexRange={[9, 7]} distanceFactor={12}>
          <div className={'fusion-card' + (blob.provisional ? ' is-provisional' : '')}>
            <div className="fusion-card__head">
              <span>{blob.title}</span>
              <button onClick={() => dismiss(blob.id)} aria-label="dismiss">
                &times;
              </button>
            </div>
            <p>{blob.body}</p>
            {blob.crossings.length > 0 ? (
              <div className="fusion-card__crossings">
                {blob.crossings.map((c) => (
                  <button key={c} onClick={() => plantFrom(c)}>
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </Html>
      </group>
    </group>
  )
}

export function FusionLayer() {
  const fusions = useGraph((s) => s.fusions)
  const mixIds = useGraph((s) => s.mixIds)
  const nodes = useGraph((s) => s.nodes)

  const mixPoints = mixIds.map((id) => worldPosition(nodes, id))

  return (
    <group>
      {fusions.map((f) => (
        <Fusion key={f.id} blob={f} />
      ))}
      {mixPoints.map((p, i) =>
        i === 0 ? null : (
          <Thread key={i} from={mixPoints[i - 1]} to={p} color="#F3C969" dashed />
        ),
      )}
    </group>
  )
}

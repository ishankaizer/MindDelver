import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { FACETS } from '../lib/facets'
import { labels, type LabelEntry } from '../lib/labels'
import { createRimMaterial } from '../lib/rim'
import { useGraph, type IdeaNode } from '../store/useGraph'

export function blobRadius(depth: number) {
  return Math.max(0.13, 0.42 * Math.pow(0.76, Math.max(0, depth - 1)))
}

const easeOutBack = (x: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

/** The one non-sea colour in the scene, so "in the mix" cannot be mistaken
 *  for a facet hue. */
const MIX_GOLD = new THREE.Color('#FFD86B')

export function Blob({ node }: { node: IdeaNode }) {
  const grow = useGraph((s) => s.grow)
  const select = useGraph((s) => s.select)
  const toggleMix = useGraph((s) => s.toggleMix)
  const selected = useGraph((s) => s.selectedId === node.id)
  const inMix = useGraph((s) => s.mixIds.includes(node.id))

  /**
   * Showing every label at once is unreadable the moment a node grows, so a
   * label is earned: the first ring always has one, and past that only the
   * selected node, its children and its path back to the seed keep theirs.
   */
  const labelled = useGraph((s) => {
    if (node.depth <= 1) return true
    const sel = s.selectedId
    if (!sel) return false
    if (sel === node.id || node.parentId === sel) return true
    let cur = s.nodes[sel]
    while (cur && cur.parentId) {
      if (cur.parentId === node.id) return true
      cur = s.nodes[cur.parentId]
    }
    return false
  })

  const [hovered, setHovered] = useState(false)
  const shellRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(0)
  const labelFadeRef = useRef(0)

  const showLabel = labelled || hovered || selected || inMix || node.pending

  const entryRef = useRef<LabelEntry>({ el: null, priority: 0, wants: 0, allowed: true })
  useEffect(() => {
    const entry = entryRef.current
    labels.set(node.id, entry)
    return () => {
      labels.delete(node.id)
    }
  }, [node.id])

  const facet = FACETS[node.facet]
  const radius = blobRadius(node.depth)
  const color = useMemo(() => new THREE.Color(facet.color), [facet.color])

  const rimMaterial = useMemo(
    () => createRimMaterial({ color: facet.color, strength: 0, power: 3 }),
    [facet.color],
  )

  useEffect(() => () => rimMaterial.dispose(), [rimMaterial])

  const world = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock, camera }) => {
    const shell = shellRef.current
    const mesh = meshRef.current
    if (!shell || !mesh) return

    const age = (performance.now() - node.born) / 620
    const birth = age >= 1 ? 1 : easeOutBack(Math.max(0, age))
    const bob = 1 + Math.sin(clock.elapsedTime * 1.6 + node.seed * 12) * 0.035
    const target = birth * bob * (hovered ? 1.3 : 1) * (selected ? 1.18 : 1)
    scaleRef.current += (target - scaleRef.current) * 0.18
    shell.scale.setScalar(scaleRef.current)

    // the blob carries its own light now, so state lives in how hard it burns
    const material = mesh.material as THREE.MeshPhysicalMaterial
    const pulse = node.pending ? 0.55 + Math.sin(clock.elapsedTime * 6) * 0.35 : 0
    material.emissiveIntensity =
      (node.grown ? 0.07 : 0.16) + pulse + (hovered || selected ? 0.18 : 0)

    const rim = rimMaterial.uniforms
    const rimColor = rim.uColor.value as THREE.Color
    rimColor.lerp(inMix ? MIX_GOLD : color, 0.12)
    const wantRim = node.pending
      ? 1.5 + Math.sin(clock.elapsedTime * 6) * 0.5
      : inMix
        ? 1.45
        : hovered || selected
          ? 1.15
          : 0.55
    rim.uStrength.value += (wantRim * birth - rim.uStrength.value) * 0.14

    if (labelRef.current) {
      mesh.getWorldPosition(world)
      const dist = world.distanceTo(camera.position)
      const near = THREE.MathUtils.clamp(1 - (dist - 12) / 32, 0.14, 1)

      const entry = entryRef.current
      entry.el = labelRef.current
      entry.wants = showLabel ? near : 0
      entry.priority = selected
        ? 1e6
        : hovered
          ? 9e5
          : inMix
            ? 8e5
            : node.pending
              ? 7e5
              : 1000 - node.depth * 100 - dist

      const target = showLabel && entry.allowed ? near : 0
      labelFadeRef.current += (target - labelFadeRef.current) * 0.14
      const opacity = labelFadeRef.current * birth
      labelRef.current.style.opacity = String(opacity)
      // hide outright once faded, so a dim label cannot sit on top of a live one
      labelRef.current.style.visibility = opacity < 0.03 ? 'hidden' : 'visible'
      const depthScale = Math.max(0.72, Math.pow(0.9, Math.max(0, node.depth - 1)))
      labelRef.current.style.setProperty(
        '--lscale',
        String(THREE.MathUtils.clamp(15 / dist, 0.55, 1.2) * depthScale * (hovered ? 1.3 : 1)),
      )
    }
  })

  return (
    <group>
      <group ref={shellRef} scale={0}>
        <mesh
          ref={meshRef}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHovered(false)
            document.body.style.cursor = 'auto'
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (e.shiftKey) {
              toggleMix(node.id)
              return
            }
            select(node.id)
            if (!node.grown) void grow(node.id)
          }}
          // a second way into the mix, because shift-click is a control nobody
          // discovers on their own
          onContextMenu={(e) => {
            e.stopPropagation()
            e.nativeEvent.preventDefault()
            toggleMix(node.id)
          }}
        >
          <sphereGeometry args={[radius, 32, 24]} />
          <meshPhysicalMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.12}
            roughness={0.42}
            metalness={0.02}
            clearcoat={0.85}
            clearcoatRoughness={0.18}
            envMapIntensity={1.15}
            transparent
            opacity={node.empty ? 0.45 : 1}
          />
        </mesh>

        <mesh material={rimMaterial} raycast={() => null}>
          <sphereGeometry args={[radius * 1.2, 24, 18]} />
        </mesh>
      </group>

      <Html position={[0, radius + 0.26, 0]} center zIndexRange={[6, 0]} pointerEvents="none">
        <div
          ref={labelRef}
          className={
            'node-label' +
            (selected ? ' is-selected' : '') +
            (inMix ? ' is-mixed' : '') +
            (node.pending ? ' is-pending' : '') +
            (node.empty ? ' is-empty' : '')
          }
          style={{ '--facet': facet.color } as React.CSSProperties}
        >
          {node.tag ? <span className="node-label__tag">{node.tag}</span> : null}
          {node.label}
          {node.pending ? <span className="node-label__more">...</span> : null}
          {!node.grown && !node.pending ? <span className="node-label__more">+</span> : null}
        </div>
      </Html>
    </group>
  )
}

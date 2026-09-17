import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { SEED_ID, useGraph } from '../store/useGraph'
import { branchCurve, quaternionTo, taperedTubeGeometry } from '../lib/growth'
import { FACETS } from '../lib/facets'
import { Blob } from './Blob'

const easeOutBack = (x: number) => {
  const c1 = 1.2
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

/** The seed is not a facet, so limbs rising out of it start from its own light. */
const SEED_COLOR = '#DCC8AE'

export function NodeBody({ id }: { id: string }) {
  const node = useGraph((s) => s.nodes[id])
  if (!node) return null
  return (
    <group>
      <Blob node={node} />
      {node.childIds.map((cid) => (
        <Limb key={cid} id={cid} />
      ))}
    </group>
  )
}

export function Limb({ id }: { id: string }) {
  const node = useGraph((s) => s.nodes[id])
  const parentFacet = useGraph((s) => {
    const pid = s.nodes[id]?.parentId
    if (!pid || pid === SEED_ID) return null
    return s.nodes[pid]?.facet ?? null
  })

  const swayRef = useRef<THREE.Group>(null)
  const branchRef = useRef<THREE.Mesh>(null)
  const tipRef = useRef<THREE.Group>(null)
  const growRef = useRef(0)

  const geometry = useMemo(() => {
    if (!node) return null
    const parentRadius = node.radius * 1.55
    return taperedTubeGeometry(
      branchCurve(node.length, node.bend),
      18,
      parentRadius,
      node.radius,
      9,
    )
  }, [node?.length, node?.radius, node?.bend])

  /**
   * The tube's uv.x runs base to tip, so the branch can fade from the colour of
   * the node it grew out of into its own. It reads as one organism instead of
   * a stack of coloured sticks, and it makes lineage legible at a glance.
   */
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.66,
      metalness: 0.0,
      envMapIntensity: 0.75,
    })
    m.defines = { USE_UV: '' }
    const uniforms = {
      uFrom: { value: new THREE.Color(SEED_COLOR) },
      uTo: { value: new THREE.Color(SEED_COLOR) },
    }
    m.userData.uniforms = uniforms
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uFrom = uniforms.uFrom
      shader.uniforms.uTo = uniforms.uTo
      shader.fragmentShader =
        'uniform vec3 uFrom;\nuniform vec3 uTo;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // held back from the facet colour at full strength: a branch that
           // matches its own node exactly leaves the node nothing to be
           diffuseColor.rgb *= mix(uFrom, uTo, smoothstep(0.02, 0.96, vUv.x)) * 0.78;`,
        )
    }
    return m
  }, [])

  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    if (!node) return
    const uniforms = material.userData.uniforms as {
      uFrom: { value: THREE.Color }
      uTo: { value: THREE.Color }
    }
    uniforms.uFrom.value.set(parentFacet ? FACETS[parentFacet].color : SEED_COLOR)
    uniforms.uTo.value.set(FACETS[node.facet].color)
    material.emissive.set(FACETS[node.facet].color)
    material.emissiveIntensity = 0.015
  }, [material, parentFacet, node?.facet])

  const quaternion = useMemo(() => (node ? quaternionTo(node.dir) : null), [node?.dir])
  const amp = node ? Math.min(0.05, 0.012 + node.depth * 0.009) : 0

  useFrame(({ clock }) => {
    if (!node) return
    const age = (performance.now() - node.born) / 720
    growRef.current = age >= 1 ? 1 : Math.max(0.001, easeOutBack(Math.max(0, age)))

    if (branchRef.current) branchRef.current.scale.y = growRef.current
    if (tipRef.current) {
      tipRef.current.position.copy(node.dir).multiplyScalar(node.length * growRef.current)
    }
    if (swayRef.current) {
      const t = clock.elapsedTime
      swayRef.current.rotation.x = Math.sin(t * 0.47 + node.seed * 20) * amp
      swayRef.current.rotation.z = Math.cos(t * 0.39 + node.seed * 33) * amp
    }
  })

  if (!node || !geometry || !quaternion) return null

  return (
    <group ref={swayRef}>
      <mesh
        ref={branchRef}
        geometry={geometry}
        material={material}
        quaternion={quaternion}
        scale={[1, 0, 1]}
      />
      <group ref={tipRef}>
        <NodeBody id={id} />
      </group>
    </group>
  )
}

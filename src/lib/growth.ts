import * as THREE from 'three'

export function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

export function branchLength(depth: number): number {
  return 4.4 * Math.pow(0.79, Math.max(0, depth - 1))
}

export function branchRadius(depth: number): number {
  return 0.155 * Math.pow(0.66, Math.max(0, depth - 1))
}

export function seedDirection(index: number, total: number): THREE.Vector3 {
  const a = (index / Math.max(1, total)) * Math.PI * 2 + 0.7
  const y = 0.25 + 0.55 * hash01(index * 3.3)
  return new THREE.Vector3(Math.cos(a), y, Math.sin(a)).normalize()
}

export function childDirection(
  parentDir: THREE.Vector3,
  index: number,
  count: number,
  depth: number,
  seed: number,
): THREE.Vector3 {
  const axis = parentDir.clone().normalize()
  const ref =
    Math.abs(axis.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const u = new THREE.Vector3().crossVectors(axis, ref).normalize()
  const v = new THREE.Vector3().crossVectors(axis, u).normalize()

  const spread = THREE.MathUtils.lerp(1.5, 1.02, Math.min(depth, 4) / 4)
  // even ring spacing beats golden-angle scatter here: with a dozen children the
  // scatter clumps, and clumped children are exactly what makes labels collide
  const phi =
    (index / Math.max(1, count)) * Math.PI * 2 +
    seed * Math.PI * 2 +
    hash01(seed * 53 + index) * 0.4
  const t = count <= 1 ? 0.5 : index / (count - 1)
  // the floor matters more than the ceiling: no child may hug the parent axis
  const theta = spread * (0.66 + 0.4 * t) * (0.88 + 0.24 * hash01(seed * 91 + index))

  return axis
    .clone()
    .multiplyScalar(Math.cos(theta))
    .addScaledVector(u, Math.sin(theta) * Math.cos(phi))
    .addScaledVector(v, Math.sin(theta) * Math.sin(phi))
    .normalize()
}

export function taperedTubeGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  r0: number,
  r1: number,
  radialSegments: number,
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false)
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const P = new THREE.Vector3()
  const normal = new THREE.Vector3()

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments
    curve.getPointAt(t, P)
    const N = frames.normals[i]
    const B = frames.binormals[i]
    const r = THREE.MathUtils.lerp(r0, r1, t)

    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2
      const sin = Math.sin(a)
      const cos = -Math.cos(a)
      normal
        .set(cos * N.x + sin * B.x, cos * N.y + sin * B.y, cos * N.z + sin * B.z)
        .normalize()
      normals.push(normal.x, normal.y, normal.z)
      positions.push(P.x + r * normal.x, P.y + r * normal.y, P.z + r * normal.z)
      uvs.push(t, j / radialSegments)
    }
  }

  for (let i = 1; i <= tubularSegments; i++) {
    for (let j = 1; j <= radialSegments; j++) {
      const a = (radialSegments + 1) * (i - 1) + (j - 1)
      const b = (radialSegments + 1) * i + (j - 1)
      const c = (radialSegments + 1) * i + j
      const d = (radialSegments + 1) * (i - 1) + j
      indices.push(a, b, d, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setIndex(indices)
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  return geo
}

export function branchCurve(length: number, bend: [number, number]): THREE.Curve<THREE.Vector3> {
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(bend[0] * length, length * 0.5, bend[1] * length),
    new THREE.Vector3(0, length, 0),
  )
}

const Y_AXIS = new THREE.Vector3(0, 1, 0)

export function quaternionTo(dir: THREE.Vector3): THREE.Quaternion {
  return new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir.clone().normalize())
}

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Atlas } from '../lib/atlas'

/**
 * Every standing piece of the reef, drawn in one call.
 *
 * The cost of a scene like this is draw calls and per-frame CPU work, not
 * triangles: nine hundred quads is nothing for a GPU, but nine hundred meshes
 * each with their own material, each billboarded by JavaScript every frame,
 * is what makes a page stutter. So all of it is one instanced quad against one
 * atlas, and everything that used to be done per object per frame - facing the
 * camera, swaying, fogging - is done in the vertex shader from a handful of
 * per-instance attributes that are uploaded once and never touched again.
 *
 * The only thing that changes per frame is a single float uniform: the clock.
 */

const VERT = /* glsl */ `
  uniform float uTime;

  attribute vec3 aPos;
  attribute vec2 aSize;
  attribute vec4 aFrame;
  attribute vec3 aTint;
  attribute vec2 aSway;
  attribute float aFlat;

  varying vec2 vUv;
  varying vec3 vTint;
  varying float vFlat;
  varying float vFogDepth;

  void main() {
    vUv = aFrame.xy + uv * aFrame.zw;
    vTint = aTint;
    vFlat = aFlat;

    // billboard around Y only. Facing the camera fully would tip the sprites
    // as the camera rises and the reef would look like it was falling over
    vec3 toCam = cameraPosition - aPos;
    vec3 right = normalize(vec3(toCam.z, 0.0, -toCam.x));

    // aPos is the foot of the sprite, not its middle, so height runs upward
    // from the sand and the sway pivots where the thing is anchored
    float up = (position.y + 0.5) * aSize.y;
    float lean = sin(uTime * 0.34 + aSway.x) * aSway.y * up;

    vec3 world = aPos + right * (position.x * aSize.x + lean) + vec3(0.0, up, 0.0);
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 fogColor;
  uniform float fogDensity;
  uniform float uSilhouetteFog;

  varying vec2 vUv;
  varying vec3 vTint;
  varying float vFlat;
  varying float vFogDepth;

  void main() {
    vec4 texel = texture2D(uAtlas, vUv);
    // a hard cut-out, not blending: it keeps the pixel edge crisp and it means
    // nothing has to be depth-sorted, which is what lets this be one draw call
    if (texel.a < 0.5) discard;

    vec3 col = mix(texel.rgb * vTint, vTint, vFlat);

    float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    // the far silhouettes hold back some of the haze on purpose. Fogged
    // honestly they would dissolve into the water at the distance they sit,
    // and the point of them is to be darker than it
    fogFactor *= mix(1.0, uSilhouetteFog, vFlat);
    col = mix(col, fogColor, clamp(fogFactor, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
  }
`

export type Piece = {
  /** foot of the sprite, on the sand */
  position: [number, number, number]
  frame: number
  height: number
  flip: boolean
  /** phase of this piece's sway, so a bed of grass does not move as one sheet */
  sway: number
  /** how far the top leans, as a fraction of height. Zero for anything rigid. */
  swayAmount: number
  tint: THREE.Color
  silhouette?: boolean
}

export function ReefField({
  pieces,
  atlas,
  silhouetteFog = 0.55,
  radius,
}: {
  pieces: Piece[]
  atlas: Atlas
  silhouetteFog?: number
  radius: number
}) {
  const material = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(1, 1)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = plane.index
    geo.setAttribute('position', plane.attributes.position)
    geo.setAttribute('uv', plane.attributes.uv)
    plane.dispose()

    const count = pieces.length
    const pos = new Float32Array(count * 3)
    const size = new Float32Array(count * 2)
    const frame = new Float32Array(count * 4)
    const tint = new Float32Array(count * 3)
    const sway = new Float32Array(count * 2)
    const flat = new Float32Array(count)

    pieces.forEach((piece, i) => {
      const f = atlas.frames[piece.frame]
      pos[i * 3] = piece.position[0]
      pos[i * 3 + 1] = piece.position[1]
      pos[i * 3 + 2] = piece.position[2]
      size[i * 2] = piece.height * f.aspect * (piece.flip ? -1 : 1)
      size[i * 2 + 1] = piece.height
      frame[i * 4] = f.u
      frame[i * 4 + 1] = f.v
      frame[i * 4 + 2] = f.w
      frame[i * 4 + 3] = f.h
      tint[i * 3] = piece.tint.r
      tint[i * 3 + 1] = piece.tint.g
      tint[i * 3 + 2] = piece.tint.b
      sway[i * 2] = piece.sway * 9
      sway[i * 2 + 1] = piece.swayAmount
      flat[i] = piece.silhouette ? 1 : 0
    })

    geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3))
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 2))
    geo.setAttribute('aFrame', new THREE.InstancedBufferAttribute(frame, 4))
    geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 3))
    geo.setAttribute('aSway', new THREE.InstancedBufferAttribute(sway, 2))
    geo.setAttribute('aFlat', new THREE.InstancedBufferAttribute(flat, 1))
    geo.instanceCount = count
    // the field rings the camera, so it is never out of frame as a whole and
    // the default bounds (computed from a unit quad at the origin) would only
    // ever cull it wrongly
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), radius)
    return geo
  }, [pieces, atlas, radius])

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock }) => {
    if (material.current) material.current.uniforms.uTime.value = clock.elapsedTime
  })

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAtlas: { value: atlas.texture },
      uSilhouetteFog: { value: silhouetteFog },
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    }),
    [atlas, silhouetteFog],
  )

  return (
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

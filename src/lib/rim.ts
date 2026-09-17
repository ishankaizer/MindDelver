import * as THREE from 'three'

/**
 * A halo painted on a slightly larger shell rather than a billboard sprite.
 * The sprite version sat flat against the camera and read as a sticker; a
 * fresnel term hugs the silhouette, so the object looks lit from behind.
 *
 * The falloff matters as much as the fresnel: fresnel alone peaks at the
 * shell's own silhouette, which draws a hard ring around everything. Ramping
 * it back down before the edge turns that ring into light.
 */
const RIM_VERT = /* glsl */ `
  uniform float uPower;
  uniform float uFalloff;
  varying float vRim;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vec3 v = normalize(-mv.xyz);
    float f = 1.0 - clamp(abs(dot(n, v)), 0.0, 1.0);
    vRim = pow(f, uPower) * smoothstep(1.0, uFalloff, f);
    gl_Position = projectionMatrix * mv;
  }
`

const RIM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  varying float vRim;
  void main() {
    float a = vRim * uStrength;
    gl_FragColor = vec4(uColor * a, a);
  }
`

export type RimOptions = {
  color: THREE.ColorRepresentation
  strength?: number
  power?: number
  falloff?: number
}

export function createRimMaterial({
  color,
  strength = 1,
  power = 3,
  falloff = 0.68,
}: RimOptions) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uStrength: { value: strength },
      uPower: { value: power },
      uFalloff: { value: falloff },
    },
    vertexShader: RIM_VERT,
    fragmentShader: RIM_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  })
}

import { useEffect, useMemo } from 'react'
import { BlendFunction, Effect } from 'postprocessing'
import { Uniform, Vector3 } from 'three'

/**
 * The 37 colours the whole dive is allowed to use. A fixed palette rather than
 * per-channel levels is the difference between pixel art and static: levels
 * quantise every pixel on its own, so a smooth gradient turns into a field of
 * dithered noise. A palette snaps whole regions onto one entry, which is what
 * gives the reference images their flat plates of colour, and it leaves the
 * dither to do its real job at the seams between them.
 *
 * It is built as ramps, not as a bag of colours: water and stone, then three
 * tones for each living hue. The reef sprites paint straight out of these
 * entries, so their shading survives the match instead of collapsing onto one
 * flat swatch, which is what happens the moment a sprite uses a colour the
 * palette cannot say.
 *
 * Held in display space, not linear, so nearest-colour is measured roughly the
 * way an eye measures it.
 */
const PALETTE = [
  // water, surface to trench
  '#ffffff', '#d7f7f4', '#a6eef2', '#57dce6', '#2db6d4', '#1c7ca8',
  '#14527e', '#0e2e56', '#081a33', '#04101f',
  // sand and stone
  '#f4ead2', '#e8d9ae', '#c9b98e', '#8a8a78', '#4a5560', '#2a3a46',
  // reef life, three tones each
  '#ff6f9f', '#c2467a', '#8e2a52',
  '#ff7a6b', '#d1354e', '#7a1f33',
  '#ff9247', '#c25a1e', '#7a3311',
  '#ffd86b', '#ffc23d',
  '#dce85c', '#9aa83a', '#5e6b22',
  '#4fd99a', '#2a8f68', '#1f7a6a',
  '#a97bf0', '#6b4ba8', '#432c6b',
  '#e26ede',
]

function toVec3(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

const FRAG = /* glsl */ `
  uniform float uPixel;
  uniform float uPalette;
  uniform float uDither;
  uniform float uSat;
  uniform vec3 uColors[${PALETTE.length}];

  // the recursive 2x2 construction, cheaper than sampling a matrix and free of
  // the dynamic-index rules that make a mat4 lookup awkward in GLSL ES
  float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x * 0.5 + a.y * a.y * 0.75);
  }
  float bayer4(vec2 a) {
    return bayer2(a * 0.5) * 0.25 + bayer2(a);
  }

  void mainUv(inout vec2 uv) {
    vec2 grid = texelSize * uPixel;
    uv = (floor(uv / grid) + 0.5) * grid;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = clamp(inputColor.rgb, 0.0, 1.0);

    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = clamp(mix(vec3(lum), c, uSat), 0.0, 1.0);

    // matching happens in display space: linear distance would read two dark
    // blues as near-identical and collapse the whole seabed onto one swatch
    vec3 g = pow(c, vec3(0.4545));

    // the offset goes in before the match, never after: nudging a pixel across
    // the boundary between two swatches is the entire mechanism
    float t = bayer4(gl_FragCoord.xy / uPixel) - 0.5;
    g = clamp(g + t * uDither, 0.0, 1.0);

    vec3 best = uColors[0];
    float bestDist = 1e9;
    for (int i = 0; i < ${PALETTE.length}; i++) {
      vec3 d = g - uColors[i];
      float dist = dot(d, d);
      if (dist < bestDist) {
        bestDist = dist;
        best = uColors[i];
      }
    }

    vec3 snapped = pow(best, vec3(2.2));
    outputColor = vec4(mix(c, snapped, uPalette), inputColor.a);
  }
`

export type PixelOptions = {
  pixel: number
  palette: number
  dither: number
  saturation: number
}

class PixelEffect extends Effect {
  constructor() {
    super('PixelEffect', FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<unknown>>([
        ['uPixel', new Uniform(4)],
        ['uPalette', new Uniform(1)],
        ['uDither', new Uniform(0.09)],
        ['uSat', new Uniform(1.18)],
        ['uColors', new Uniform(PALETTE.map(toVec3))],
      ]),
    })
  }

  set(o: PixelOptions) {
    const u = this.uniforms as Map<string, Uniform<number>>
    u.get('uPixel')!.value = o.pixel
    u.get('uPalette')!.value = o.palette
    u.get('uDither')!.value = o.dither
    u.get('uSat')!.value = o.saturation
  }
}

export function Pixelate(props: PixelOptions) {
  const effect = useMemo(() => new PixelEffect(), [])
  useEffect(() => () => effect.dispose(), [effect])
  // uniforms, not a rebuilt effect: swapping the instance would make the
  // composer tear down and re-link the whole pass on every grade change
  effect.set(props)
  return <primitive object={effect} dispose={null} />
}

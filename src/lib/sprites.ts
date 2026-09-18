import { pixelCanvas, rng } from './sea'

/**
 * The reef's cast of sprites, generated at runtime rather than shipped as art.
 *
 * The taxonomy is taken from how reef sprite packs actually break the reef up,
 * because "coral" is not one shape: branching (staghorn), massive (brain),
 * plating (table), soft fans, sponges (tube and barrel), fleshy polyps
 * (bubble, zoanthid, toadstool), anemones, and the grasses. Each of those
 * silhouettes is distinct at sixteen pixels, which is the only test that
 * matters here, and together they are what stops a seabed reading as one
 * repeated bush.
 */

/**
 * Every ramp is three tones plus an accent, and every tone is a swatch the
 * pixel pass already owns. Picking colours the palette cannot represent is the
 * fastest way to get mud: the nearest-colour match would drag them onto some
 * unrelated blue.
 */
export type Ramp = { shade: string; mid: string; light: string; tip: string }

export const RAMPS = {
  rose: { shade: '#8E2A52', mid: '#C2467A', light: '#FF6F9F', tip: '#F4EAD2' },
  crimson: { shade: '#7A1F33', mid: '#D1354E', light: '#FF7A6B', tip: '#FFC23D' },
  ember: { shade: '#7A3311', mid: '#C25A1E', light: '#FF9247', tip: '#FFD86B' },
  sun: { shade: '#C25A1E', mid: '#FFC23D', light: '#FFD86B', tip: '#F4EAD2' },
  lime: { shade: '#5E6B22', mid: '#9AA83A', light: '#DCE85C', tip: '#F4EAD2' },
  jade: { shade: '#1F7A6A', mid: '#2A8F68', light: '#4FD99A', tip: '#DCE85C' },
  violet: { shade: '#432C6B', mid: '#6B4BA8', light: '#A97BF0', tip: '#E26EDE' },
  orchid: { shade: '#6B4BA8', mid: '#E26EDE', light: '#FF6F9F', tip: '#D7F7F4' },
  bone: { shade: '#8A8A78', mid: '#C9B98E', light: '#E8D9AE', tip: '#F4EAD2' },
} satisfies Record<string, Ramp>

export type RampName = keyof typeof RAMPS

/**
 * Stone stays desaturated so the living colour has something to sit against,
 * but never blue: a rock painted in the water's own hue stops being a rock and
 * becomes a hole in the seabed.
 */
const STONE: Ramp = { shade: '#2A3A46', mid: '#4A5560', light: '#8A8A78', tip: '#C9B98E' }
const STONE_WARM: Ramp = { shade: '#4A5560', mid: '#8A8A78', light: '#C9B98E', tip: '#E8D9AE' }

const OUTLINE = '#0E2E56'
const SAND = '#C9B98E'

const RGB = new Map<string, [number, number, number]>()
function rgb(hex: string): [number, number, number] {
  let v = RGB.get(hex)
  if (!v) {
    const n = parseInt(hex.slice(1), 16)
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    RGB.set(hex, v)
  }
  return v
}

/**
 * A sprite carries its own aspect so the scene can pick a height and get the
 * width for free. Scaling a card to an arbitrary rectangle is what makes
 * generated pixel art look melted.
 *
 * It hands back a canvas rather than a texture because every sprite ends up
 * packed into one atlas: a texture each would mean a material each, and a
 * material each means a draw call each.
 */
export type Sprite = { canvas: HTMLCanvasElement; aspect: number }

/**
 * Writing bytes into one ImageData beats fillRect per pixel by enough to matter
 * when the reef builds fifty sprites during the first frame, and the alpha
 * channel doubles as the mask the outline pass reads.
 */
function painter(w: number, h: number) {
  const { canvas, ctx } = pixelCanvas(w, h)
  const img = ctx.createImageData(w, h)
  const d = img.data

  const px = (x: number, y: number, hex: string) => {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) return
    const c = rgb(hex)
    const i = (iy * w + ix) * 4
    d[i] = c[0]
    d[i + 1] = c[1]
    d[i + 2] = c[2]
    d[i + 3] = 255
  }

  const clear = (x: number, y: number) => {
    const ix = Math.round(x)
    const iy = Math.round(y)
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) return
    d[(iy * w + ix) * 4 + 3] = 0
  }

  const rect = (x: number, y: number, rw: number, rh: number, hex: string) => {
    for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) px(x + i, y + j, hex)
  }

  const disc = (cx: number, cy: number, r: number, hex: string) => {
    const r2 = r * r
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = x - cx
        const dy = y - cy
        if (dx * dx + dy * dy <= r2) px(x, y, hex)
      }
    }
  }

  /** Bridges short horizontal gaps on alternate rows, turning a branch skeleton into a net. */
  const weave = (maxGap: number, hex: string) => {
    for (let y = 0; y < h; y += 2) {
      let run = -1
      for (let x = 0; x < w; x++) {
        const solid = d[(y * w + x) * 4 + 3] > 0
        if (solid) {
          if (run >= 0 && x - run > 1 && x - run <= maxGap) {
            for (let g = run + 1; g < x; g++) px(g, y, hex)
          }
          run = x
        }
      }
    }
  }

  /** A one-cell dark border. It is what makes a sprite sit in the water rather than dissolve into it. */
  const outline = (hex = OUTLINE) => {
    const c = rgb(hex)
    const add: number[] = []
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (d[i + 3] > 0) continue
        const near =
          (x > 0 && d[i - 1] > 0) ||
          (x < w - 1 && d[i + 7] > 0) ||
          (y > 0 && d[i - w * 4 + 3] > 0) ||
          (y < h - 1 && d[i + w * 4 + 3] > 0)
        if (near) add.push(i)
      }
    }
    for (const i of add) {
      d[i] = c[0]
      d[i + 1] = c[1]
      d[i + 2] = c[2]
      d[i + 3] = 255
    }
  }

  const finish = (): Sprite => {
    ctx.putImageData(img, 0, 0)
    return { canvas, aspect: w / h }
  }

  return { px, clear, rect, disc, weave, outline, finish, w, h }
}

type Painter = ReturnType<typeof painter>

const RAMP_KEYS = Object.keys(RAMPS) as RampName[]
const WARM: RampName[] = ['rose', 'crimson', 'ember', 'sun', 'orchid']
/** Everything except bone, which reads as driftwood the moment it grows branches. */
const LIVE: RampName[] = ['rose', 'crimson', 'ember', 'sun', 'lime', 'jade', 'violet', 'orchid']

function pick<T>(rand: () => number, list: readonly T[]) {
  return list[Math.floor(rand() * list.length) % list.length]
}

/**
 * A limb of a branching coral. Each step lays a short span of cells across the
 * stroke and colours it by position within the span, which is the cheap way to
 * make a flat run of pixels read as a tube. The pale tip is not decoration:
 * growing acropora really is bleached-looking at the growing end, and it is
 * what separates one branch from the one behind it.
 */
function limb(
  p: Painter,
  x: number,
  y: number,
  angle: number,
  len: number,
  thick: number,
  depth: number,
  ramp: Ramp,
  rand: () => number,
  splitChance = 0.16,
) {
  let cx = x
  let cy = y
  for (let i = 0; i < len; i++) {
    const wobble = (rand() - 0.5) * 0.3
    cx += Math.cos(angle + wobble)
    cy += Math.sin(angle + wobble)
    const t = Math.max(1, Math.round(thick))
    // only the outermost branches get pale tips: tipping every generation
    // turns the whole colony into one bleached blotch
    const tipping = i > len - 2.5 && depth < 2
    for (let o = 0; o < t; o++) {
      const at = Math.round(cx) + o - (t >> 1)
      const hex = tipping ? ramp.tip : o === 0 && t > 2 ? ramp.shade : o === t - 1 ? ramp.light : ramp.mid
      p.px(at, Math.round(cy), hex)
      if (t > 2) p.px(at, Math.round(cy) - 1, hex)
    }
    if (depth > 0 && i > len * 0.3 && rand() < splitChance) {
      const side = rand() < 0.5 ? 1 : -1
      limb(
        p,
        cx,
        cy,
        angle + side * (0.45 + rand() * 0.55),
        len * (0.42 + rand() * 0.3),
        thick * 0.72,
        depth - 1,
        ramp,
        rand,
        splitChance,
      )
    }
  }
}

function staghorn(rand: () => number): Sprite {
  const p = painter(52, 52)
  const ramp = RAMPS[pick(rand, LIVE)]
  const trunks = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < trunks; i++) {
    limb(
      p,
      p.w * (0.28 + rand() * 0.44),
      p.h - 1,
      -Math.PI / 2 + (rand() - 0.5) * 0.8,
      p.h * (0.45 + rand() * 0.42),
      3.6,
      3,
      ramp,
      rand,
    )
  }
  p.outline()
  return p.finish()
}

/**
 * Brain coral: a boulder whose whole identity is the meander on its surface.
 * The channels have to run roughly with the dome and wander along it; grooves
 * scattered in both directions at once are just noise, which is what a plain
 * two-axis sine gives you.
 */
function brain(rand: () => number): Sprite {
  const p = painter(46, 32)
  const ramp = RAMPS[pick(rand, [...WARM, 'jade', 'bone'] as RampName[])]
  const phase = rand() * 6.28
  const squat = 0.82 + rand() * 0.16
  const wander = 2.2 + rand() * 1.4
  for (let x = 1; x < p.w - 1; x++) {
    const env = Math.pow(Math.sin((Math.PI * (x + 0.5)) / p.w), 0.6)
    const top = p.h - Math.round((p.h - 2) * squat * env)
    for (let y = top; y < p.h; y++) {
      const groove = Math.sin(y * 0.85 + Math.sin(x * 0.38 + phase) * wander)
      let hex = ramp.mid
      if (groove > 0.42) hex = ramp.shade
      else if (groove < -0.75) hex = ramp.light
      if (y < top + 2 && groove <= 0.42) hex = ramp.light
      if (y > p.h - 3) hex = ramp.shade
      p.px(x, y, hex)
    }
  }
  p.outline()
  return p.finish()
}

/** Table acropora: one flat plate held up on a stem, growing sideways for light. */
function table(rand: () => number): Sprite {
  const p = painter(58, 34)
  const ramp = RAMPS[pick(rand, LIVE)]
  const cx = p.w / 2 + (rand() - 0.5) * 4
  const plateY = 10 + Math.round(rand() * 6)

  for (let y = plateY; y < p.h; y++) {
    const half = 2 + Math.round(((y - plateY) / (p.h - plateY)) * 2.5)
    for (let x = cx - half; x <= cx + half; x++) {
      p.px(x, y, x < cx - half + 1 ? ramp.shade : x > cx + half - 1 ? ramp.light : ramp.mid)
    }
  }

  const rx = p.w / 2 - 2
  for (let x = 1; x < p.w - 1; x++) {
    const dx = (x - p.w / 2) / rx
    if (Math.abs(dx) > 1) continue
    const arc = Math.round(3 * (1 - dx * dx))
    const top = plateY - arc
    const th = 2 + Math.round(3 * (1 - Math.abs(dx)))
    for (let y = top; y < top + th; y++) {
      p.px(x, y, y === top ? ramp.light : y === top + th - 1 ? ramp.shade : ramp.mid)
    }
    if (x % 5 === 0) p.px(x, top, ramp.tip)
  }
  p.outline()
  return p.finish()
}

/**
 * Sea fan. A gorgonian splits in two at every generation and never at random,
 * which matters: a per-step chance of splitting compounds into thousands of
 * twigs and the sprite turns into a rectangle of static. Five fixed
 * generations with a narrowing spread is a fan, and it is also bounded.
 */
function fanBranch(
  p: Painter,
  x: number,
  y: number,
  angle: number,
  len: number,
  gen: number,
  ramp: Ramp,
  rand: () => number,
) {
  let cx = x
  let cy = y
  const thick = gen < 2 ? 2 : 1
  for (let i = 0; i < len; i++) {
    cx += Math.cos(angle)
    cy += Math.sin(angle)
    for (let t = 0; t < thick; t++) {
      p.px(cx + t, cy, i > len - 2 && gen > 2 ? ramp.tip : t === 0 ? ramp.mid : ramp.light)
    }
  }
  if (gen >= 5) return
  const spread = 0.66 - gen * 0.08
  for (const side of [-1, 1]) {
    const next = angle + side * spread * (0.7 + rand() * 0.6)
    // the clamp is the fan: without it the outer branches curl back downward
    const bounded = Math.max(-Math.PI / 2 - 1.2, Math.min(-Math.PI / 2 + 1.2, next))
    fanBranch(p, cx, cy, bounded, len * (0.74 + rand() * 0.14), gen + 1, ramp, rand)
  }
}

function fan(rand: () => number): Sprite {
  const p = painter(48, 44)
  const ramp = RAMPS[pick(rand, ['violet', 'orchid', 'crimson', 'rose', 'sun'] as RampName[])]
  const base = p.w / 2 + (rand() - 0.5) * 4
  fanBranch(p, base, p.h - 3, -Math.PI / 2 + (rand() - 0.5) * 0.2, 8 + rand() * 2.5, 0, ramp, rand)

  // the mesh. A gorgonian is a net, not a tree: anastomosis is the word for
  // neighbouring branches fusing, and without it the sprite reads as a bare
  // shrub. Bridging only short gaps, and only on alternate rows, keeps it lacy
  p.weave(5, ramp.mid)

  // a holdfast, or the whole thing looks pinned to the sand by a single pixel
  p.rect(base - 3, p.h - 3, 6, 3, ramp.shade)
  p.outline()
  return p.finish()
}

/** Tube sponges: a clutch of pipes, each with a dark mouth. Tallest go in first so they sit behind. */
function tubeSponge(rand: () => number): Sprite {
  const p = painter(46, 50)
  const ramp = RAMPS[pick(rand, ['sun', 'ember', 'violet', 'crimson', 'orchid'] as RampName[])]
  const count = 3 + Math.floor(rand() * 3)
  const tubes = Array.from({ length: count }, () => ({
    x: 3 + rand() * (p.w - 14),
    w: 5 + Math.round(rand() * 4),
    h: p.h * (0.42 + rand() * 0.52),
    lean: (rand() - 0.5) * 0.18,
  })).sort((a, b) => b.h - a.h)

  for (const t of tubes) {
    const top = Math.round(p.h - t.h)
    for (let y = p.h - 1; y >= top; y--) {
      const off = Math.round((p.h - y) * t.lean)
      for (let i = 0; i < t.w; i++) {
        const x = t.x + i + off
        const hex = i === 0 ? ramp.shade : i >= t.w - 2 ? ramp.light : ramp.mid
        p.px(x, y, (p.h - y) % 6 === 0 && i > 0 && i < t.w - 1 ? ramp.shade : hex)
      }
    }
    // the mouth: a dark opening set into a rounded lip, which is the one
    // detail that makes a stack of rectangles read as pipes
    const off = Math.round(t.h * t.lean)
    for (let i = 0; i < t.w; i++) {
      const x = t.x + i + off
      const rim = i === 0 || i === t.w - 1
      if (rim) {
        p.clear(x, top)
        p.px(x, top + 1, ramp.light)
      } else {
        p.px(x, top, ramp.light)
        p.px(x, top + 1, ramp.shade)
        p.px(x, top + 2, ramp.shade)
      }
    }
  }
  p.outline()
  return p.finish()
}

/** Barrel sponge: one wide vessel, ridged, open at the top. */
function barrelSponge(rand: () => number): Sprite {
  const p = painter(42, 36)
  const ramp = RAMPS[pick(rand, ['crimson', 'ember', 'rose', 'bone', 'violet'] as RampName[])]
  const cx = p.w / 2
  const top = 5 + Math.round(rand() * 4)
  const footHalf = 7 + rand() * 3
  const mouthHalf = 12 + rand() * 4

  for (let y = p.h - 1; y >= top; y--) {
    const k = (p.h - 1 - y) / (p.h - 1 - top)
    const half = Math.round(footHalf + (mouthHalf - footHalf) * Math.pow(k, 0.7))
    for (let x = cx - half; x <= cx + half; x++) {
      const edge = x < cx - half + 2 ? ramp.shade : x > cx + half - 3 ? ramp.light : ramp.mid
      p.px(x, y, Math.round(x - cx) % 5 === 0 ? ramp.shade : edge)
    }
  }
  // the osculum, and a lip rolled over it: a flat-topped barrel is a bucket
  p.clear(cx - mouthHalf, top)
  p.clear(cx + mouthHalf, top)
  for (let x = cx - mouthHalf + 1; x <= cx + mouthHalf - 1; x++) {
    const inner = Math.abs(x - cx) < mouthHalf - 2
    p.px(x, top, ramp.light)
    p.px(x, top + 1, inner ? ramp.shade : ramp.mid)
    if (inner) p.px(x, top + 2, ramp.shade)
  }
  p.outline()
  return p.finish()
}

/** Bubble and frogspawn corals: fat vesicles, each with one highlight. */
function bubble(rand: () => number): Sprite {
  const p = painter(42, 28)
  const ramp = RAMPS[pick(rand, LIVE)]
  const count = 6 + Math.floor(rand() * 5)
  for (let i = 0; i < count; i++) {
    const r = 3 + rand() * 3
    const x = 5 + rand() * (p.w - 10)
    const y = p.h - 3 - rand() * (p.h * 0.55)
    p.disc(x, y, r, ramp.mid)
    p.disc(x - r * 0.3, y - r * 0.3, r * 0.55, ramp.light)
    p.px(x - r * 0.4, y - r * 0.5, ramp.tip)
    p.disc(x + r * 0.45, y + r * 0.5, r * 0.3, ramp.shade)
  }
  p.outline()
  return p.finish()
}

/** Zoanthid mat: a crust of button polyps over a low rock. */
function polyps(rand: () => number): Sprite {
  const p = painter(46, 22)
  const ramp = RAMPS[pick(rand, RAMP_KEYS)]
  const alt = RAMPS[pick(rand, RAMP_KEYS)]
  const tops: number[] = []
  for (let x = 1; x < p.w - 1; x++) {
    const env = Math.sin((Math.PI * (x + 0.5)) / p.w)
    const top = p.h - 2 - Math.round(7 * env + Math.sin(x * 0.4) * 1.5)
    tops[x] = top
    for (let y = top; y < p.h; y++) p.px(x, y, y < top + 2 ? STONE.light : y > p.h - 4 ? STONE.shade : STONE.mid)
  }
  const count = 8 + Math.floor(rand() * 6)
  for (let i = 0; i < count; i++) {
    const x = 3 + Math.round(rand() * (p.w - 7))
    const y = (tops[x] ?? p.h - 4) - 1
    const r = rand() < 0.5 ? 2 : 3
    const c = rand() < 0.35 ? alt : ramp
    p.disc(x, y, r, c.mid)
    p.disc(x, y, r - 1, c.light)
    p.px(x, y, c.tip)
  }
  p.outline()
  return p.finish()
}

/** Toadstool leather coral: a soft stalk under a drooping cap. */
function toadstool(rand: () => number): Sprite {
  const p = painter(40, 44)
  const ramp = RAMPS[pick(rand, ['bone', 'lime', 'jade', 'sun', 'ember'] as RampName[])]
  const cx = p.w / 2 + (rand() - 0.5) * 4
  const capY = 14 + Math.round(rand() * 6)
  const stalk = 3 + Math.round(rand() * 2)

  for (let y = capY; y < p.h; y++) {
    const w = stalk + Math.round(((y - capY) / (p.h - capY)) * 3)
    for (let x = cx - w; x <= cx + w; x++) {
      p.px(x, y, x < cx - w + 1 ? ramp.shade : x > cx + w - 1 ? ramp.light : ramp.mid)
    }
  }

  const rx = p.w / 2 - 3
  for (let x = 2; x < p.w - 2; x++) {
    const dx = (x - cx) / rx
    if (Math.abs(dx) > 1) continue
    const dome = Math.round(9 * Math.sqrt(Math.max(0, 1 - dx * dx)))
    const droop = Math.round(Math.sin(x * 0.8) * 1.2)
    const top = capY - dome
    const bottom = capY + 3 + droop - Math.round(Math.abs(dx) * 3)
    for (let y = top; y <= bottom; y++) {
      p.px(x, y, y < top + 2 ? ramp.light : y > bottom - 2 ? ramp.shade : ramp.mid)
    }
    if (x % 4 === 0) p.px(x, top + 2, ramp.tip)
  }
  p.outline()
  return p.finish()
}

/** Anemone: a column you barely see under a crown of tentacles with pale tips. */
function anemone(rand: () => number): Sprite {
  const p = painter(42, 40)
  const ramp = RAMPS[pick(rand, ['rose', 'orchid', 'violet', 'sun', 'jade'] as RampName[])]
  const cx = p.w / 2 + (rand() - 0.5) * 4
  const colTop = 20 + Math.round(rand() * 6)

  for (let y = colTop; y < p.h; y++) {
    const w = 4 + Math.round(((y - colTop) / (p.h - colTop)) * 2)
    for (let x = cx - w; x <= cx + w; x++) {
      p.px(x, y, x < cx - w + 1 ? ramp.shade : x > cx + w - 1 ? ramp.light : ramp.mid)
    }
  }

  const arms = 14 + Math.floor(rand() * 8)
  for (let i = 0; i < arms; i++) {
    const spread = (i / (arms - 1)) * 2 - 1
    const angle = -Math.PI / 2 + spread * 1.15 + (rand() - 0.5) * 0.2
    const len = 8 + rand() * 9
    let x = cx + spread * 3
    let y = colTop + 1
    for (let s = 0; s < len; s++) {
      const curl = Math.sin(s * 0.28 + i) * 0.22
      x += Math.cos(angle + curl)
      y += Math.sin(angle + curl)
      p.px(x, y, s > len - 3 ? ramp.tip : s < 2 ? ramp.shade : ramp.light)
    }
  }
  p.outline()
  return p.finish()
}

/**
 * Seagrass. Blades from one root, each tapering to a single cell and each with
 * its own lean, because a bed of identically-leaning blades reads as a comb.
 * A couple of blades in the second ramp is what keeps a big meadow from
 * banding into one flat green.
 */
function blades(
  p: Painter,
  count: number,
  rootWidth: number,
  minLen: number,
  maxLen: number,
  ramp: Ramp,
  alt: Ramp,
  rand: () => number,
) {
  for (let i = 0; i < count; i++) {
    const c = rand() < 0.22 ? alt : ramp
    const lean = (rand() - 0.5) * 1.7
    const len = p.h * (minLen + rand() * (maxLen - minLen))
    const curve = 0.6 + rand() * 0.9
    let x = p.w / 2 + (rand() - 0.5) * rootWidth
    let y = p.h - 1
    for (let s = 0; s < len; s++) {
      const k = s / len
      // the lean builds with height instead of being constant, so a blade
      // bends away from the root the way a leaf does rather than tilting
      x += lean * 0.14 * (0.3 + k * curve)
      y -= 1
      const th = k < 0.5 ? 2 : 1
      for (let t = 0; t < th; t++) {
        p.px(x + t, y, k > 0.86 ? c.light : t === 0 ? c.mid : c.light)
      }
    }
  }
}

function seagrass(rand: () => number): Sprite {
  const p = painter(40, 46)
  const ramp = RAMPS[pick(rand, ['jade', 'lime'] as RampName[])]
  const alt = RAMPS[pick(rand, ['jade', 'lime', 'sun'] as RampName[])]
  blades(p, 12 + Math.floor(rand() * 8), 11, 0.5, 0.96, ramp, alt, rand)
  p.outline()
  return p.finish()
}

/**
 * A grass tuft: shorter, wider and much denser than a seagrass clump, meant to
 * be tiled in the hundreds across the sand. Meadows are the one place a lawn
 * is the right answer, so these are made to overlap into a continuous bed.
 */
function grass(rand: () => number): Sprite {
  const p = painter(34, 24)
  const ramp = RAMPS[pick(rand, ['jade', 'lime'] as RampName[])]
  const alt = RAMPS[pick(rand, ['jade', 'lime'] as RampName[])]
  blades(p, 16 + Math.floor(rand() * 10), 22, 0.45, 1.0, ramp, alt, rand)
  p.outline()
  return p.finish()
}

/**
 * Seaweed: a stalk hung with broad wavy fronds. It is the wide-leaved
 * counterweight to kelp's strands, and reads completely differently at a
 * distance, which is the only reason to have both.
 */
function seaweed(rand: () => number): Sprite {
  const p = painter(36, 50)
  const ramp = RAMPS[pick(rand, ['jade', 'lime'] as RampName[])]
  const stalkX = p.w / 2 + (rand() - 0.5) * 5
  const top = 4 + rand() * 8
  const amp = 1.5 + rand() * 2.5
  const freq = 0.14 + rand() * 0.07
  const phase = rand() * 6.28

  for (let y = p.h - 1; y > top; y--) {
    const k = (p.h - y) / p.h
    const x = stalkX + Math.sin(y * freq + phase) * amp * k
    p.px(x, y, ramp.shade)
    p.px(x + 1, y, ramp.mid)

    if ((y - Math.round(top)) % 6 === 0 && k > 0.12) {
      const side = ((y / 6) | 0) % 2 === 0 ? 1 : -1
      const span = 4 + Math.round(rand() * 5)
      for (let b = 1; b <= span; b++) {
        const droop = Math.round(b * 0.55)
        const thick = b < span - 1 ? 3 : 2
        for (let t = 0; t < thick; t++) {
          const fx = x + side * b + (side > 0 ? 1 : 0)
          p.px(fx, y - 2 + droop + t, t === 0 ? ramp.light : ramp.mid)
        }
      }
    }
  }
  p.outline()
  return p.finish()
}

/** Kelp: long strands with blades hanging off them, reaching well above everything else. */
function kelp(rand: () => number): Sprite {
  const p = painter(30, 72)
  const ramp = RAMPS[pick(rand, ['jade', 'lime'] as RampName[])]
  const strands = 2 + Math.floor(rand() * 2)
  for (let s = 0; s < strands; s++) {
    const baseX = p.w * (0.25 + rand() * 0.5)
    const amp = 2 + rand() * 4
    const freq = 0.1 + rand() * 0.08
    const top = p.h * (0.04 + rand() * 0.22)
    const phase = rand() * 6.28
    for (let y = p.h - 1; y > top; y--) {
      const k = (p.h - y) / p.h
      const x = baseX + Math.sin(y * freq + phase) * amp * k
      p.px(x, y, ramp.shade)
      p.px(x + 1, y, ramp.mid)
      if (y % 7 === 0) {
        const side = y % 14 === 0 ? 1 : -1
        const blade = 3 + Math.round(rand() * 3)
        for (let b = 1; b <= blade; b++) {
          p.px(x + side * b + (side > 0 ? 1 : 0), y - Math.round(b * 0.4), ramp.light)
          if (b < blade - 1) p.px(x + side * b + (side > 0 ? 1 : 0), y - Math.round(b * 0.4) + 1, ramp.mid)
        }
      }
    }
  }
  p.outline()
  return p.finish()
}

/**
 * Rock outcrops with flat terraces. The terraces are the tell: reference art
 * never uses a smooth slope, it stacks ledges, and that is what stops a
 * silhouette reading as a blurred lump once it is scaled up. The living crust
 * on the ledges is what makes it reef rather than quarry.
 */
function rock(rand: () => number): Sprite {
  const p = painter(66, 42)
  const stone = rand() < 0.4 ? STONE_WARM : STONE
  const crust = RAMPS[pick(rand, RAMP_KEYS)]
  // the ceiling matters: a level pinned at full height for most of the width
  // gives a smooth dome no matter how big the steps are
  let level = p.h * (0.45 + rand() * 0.35)
  let hold = 0
  const tops: number[] = []

  for (let x = 1; x < p.w - 1; x++) {
    if (hold <= 0) {
      hold = 3 + Math.floor(rand() * 8)
      level = Math.max(6, Math.min(p.h - 5, level + Math.round((rand() - 0.5) * p.h * 0.3)))
    }
    hold--
    // the terraces alone give a skyline; a dome envelope over them is what
    // turns the same silhouette back into an outcrop sitting on a seabed. The
    // low exponent keeps the flanks steep so the ledges survive the envelope
    const dome = Math.pow(Math.sin((Math.PI * (x + 0.5)) / p.w), 0.3)
    const top = p.h - Math.round(level * dome)
    tops[x] = top
    for (let y = top; y < p.h; y++) {
      p.px(x, y, y < top + 2 ? stone.light : y > p.h - 4 ? stone.shade : stone.mid)
    }
  }

  // the risers between ledges. A terraced skyline on its own still reads as one
  // smooth lump once it is shaded; it is the dark face under each step up that
  // says the rock has depth to it
  for (let x = 2; x < p.w - 1; x++) {
    const here = tops[x]
    const prev = tops[x - 1]
    if (here === undefined || prev === undefined) continue
    if (Math.abs(here - prev) < 2) continue
    const from = Math.min(here, prev)
    const to = Math.max(here, prev)
    for (let y = from; y <= to; y++) p.px(here < prev ? x - 1 : x, y, stone.shade)
  }

  for (let x = 2; x < p.w - 2; x++) {
    const top = tops[x]
    if (top === undefined || top > p.h - 6) continue
    if (rand() < 0.28) p.px(x, top, crust.mid)
    if (rand() < 0.1) {
      p.disc(x, top - 1, 1.6, crust.mid)
      p.px(x, top - 1, crust.light)
    }
  }
  p.outline()
  return p.finish()
}

/**
 * Boulders bedded into sand. The lighting is a thin crescent on each side of
 * the stone rather than a second disc laid on top: a big dark disc inside a
 * boulder does not read as shadow, it reads as a hole.
 */
function boulder(rand: () => number): Sprite {
  const p = painter(54, 32)
  const stone = rand() < 0.45 ? STONE_WARM : STONE
  const count = 2 + Math.floor(rand() * 2)
  const stones = Array.from({ length: count }, () => ({
    r: 7 + rand() * 6,
    cx: 9 + rand() * (p.w - 18),
    cy: p.h - 4 - rand() * 3,
  })).sort((a, b) => b.r - a.r)

  for (const s of stones) {
    for (let y = Math.floor(s.cy - s.r); y <= p.h - 2; y++) {
      for (let x = Math.floor(s.cx - s.r); x <= s.cx + s.r; x++) {
        const dx = (x - s.cx) / s.r
        const dy = (y - s.cy) / (s.r * 0.92)
        const d = Math.hypot(dx, dy)
        if (d > 1) continue
        const lit = -dx * 0.7 - dy * 0.7
        p.px(x, y, d > 0.86 && lit > 0.2 ? stone.light : lit < -0.35 ? stone.shade : stone.mid)
      }
    }
    if (rand() < 0.6) {
      const crust = RAMPS[pick(rand, RAMP_KEYS)]
      p.disc(s.cx - s.r * 0.2, s.cy - s.r * 0.78, 2, crust.mid)
      p.px(s.cx - s.r * 0.2, s.cy - s.r * 0.78, crust.light)
    }
    // sand only banks up against the stone, never past it
    p.rect(s.cx - s.r, p.h - 2, s.r * 2, 2, SAND)
  }
  p.outline()
  return p.finish()
}

/** Starfish, clinging to whatever it is scaled onto. */
function star(rand: () => number): Sprite {
  const p = painter(22, 22)
  const ramp = RAMPS[pick(rand, ['ember', 'crimson', 'rose', 'sun', 'violet'] as RampName[])]
  const cx = p.w / 2
  const cy = p.h / 2
  const spin = rand() * 6.28
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const dx = x - cx
      const dy = y - cy
      const r = Math.hypot(dx, dy)
      const a = Math.atan2(dy, dx) + spin
      const edge = 3.2 + 6.2 * Math.pow(Math.abs(Math.cos(a * 2.5)), 0.7)
      if (r <= edge) p.px(x, y, r < 2.5 ? ramp.light : r > edge - 1.5 ? ramp.shade : ramp.mid)
    }
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.28 - spin
    p.px(cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, ramp.tip)
  }
  p.outline()
  return p.finish()
}

/**
 * A conch, not a flat spiral. At twenty cells a true coil has no room to show
 * its turns and collapses into a disc, whereas a cone with a stepped spire and
 * banding is legible immediately and is what a shell looks like side on.
 */
function shell(rand: () => number): Sprite {
  const p = painter(20, 22)
  const ramp = RAMPS[pick(rand, ['bone', 'sun', 'rose', 'ember'] as RampName[])]
  const apex = 2 + Math.round(rand() * 2)
  const lean = (rand() - 0.5) * 0.35

  for (let y = apex; y < p.h - 1; y++) {
    const k = (y - apex) / (p.h - 1 - apex)
    const half = 1 + Math.round(Math.pow(k, 0.78) * 7.5)
    const cx = p.w / 2 + lean * (y - apex)
    for (let x = cx - half; x <= cx + half; x++) {
      const across = (x - (cx - half)) / (half * 2 || 1)
      let hex = across < 0.22 ? ramp.shade : across > 0.72 ? ramp.light : ramp.mid
      // the steps of the spire: one dark notch per whorl, walking outward
      if ((y - apex) % 4 === 0 && x > cx + half - 3) hex = ramp.shade
      p.px(x, y, hex)
    }
    // banding across the body whorl
    if ((y - apex) % 3 === 1) p.px(cx - half + 1, y, ramp.tip)
  }

  // the aperture, the one dark hole that tells you it is hollow
  const lipY = p.h - 4
  for (let y = lipY; y < p.h - 1; y++) {
    for (let x = p.w / 2 - 1; x < p.w / 2 + 3; x++) p.px(x, y, ramp.shade)
  }
  p.outline()
  return p.finish()
}

/** Urchin: a dark body that is almost entirely spines. */
function urchin(rand: () => number): Sprite {
  const p = painter(26, 26)
  const ramp = RAMPS[pick(rand, ['violet', 'crimson', 'orchid'] as RampName[])]
  const cx = p.w / 2
  const cy = p.h - 8
  const spines = 14 + Math.floor(rand() * 8)
  for (let i = 0; i < spines; i++) {
    const a = -Math.PI + (i / spines) * Math.PI * 1.0 - 0.1
    const len = 5 + rand() * 6
    for (let s = 2; s < len; s++) {
      p.px(cx + Math.cos(a) * s, cy + Math.sin(a) * s * 0.9, s > len - 2 ? ramp.light : ramp.mid)
    }
  }
  p.disc(cx, cy, 5, ramp.shade)
  p.disc(cx - 1, cy - 1, 2.5, ramp.mid)
  p.outline()
  return p.finish()
}

/**
 * Giant clam: two ribbed valves with the mantle glowing in the gap. The ribs
 * have to fan from the hinge rather than run straight, because that fan is the
 * only thing distinguishing a clam from a rock with a stripe on it.
 */
function clam(rand: () => number): Sprite {
  const p = painter(28, 22)
  const ramp = RAMPS[pick(rand, ['violet', 'jade', 'orchid', 'rose'] as RampName[])]
  const cx = p.w / 2
  const seam = p.h - 8
  const rx = p.w / 2 - 2

  for (let x = 2; x < p.w - 2; x++) {
    const dx = (x - cx) / rx
    if (Math.abs(dx) > 1) continue
    const round = Math.sqrt(Math.max(0, 1 - dx * dx))
    const wave = Math.round(Math.sin(x * 0.8) * 1.1)
    const gap = seam + wave

    const lower = Math.round(5 * round)
    for (let y = gap + 1; y <= gap + lower; y++) {
      p.px(x, y, y > gap + lower - 2 ? STONE.shade : STONE.mid)
    }
    const upper = Math.round(7 * round)
    for (let y = gap - upper; y < gap; y++) {
      const up = (gap - y) / Math.max(1, upper)
      p.px(x, y, up > 0.8 ? STONE.light : STONE.mid)
    }
    // ribs, fanning out from the hinge
    if (Math.round(Math.abs(dx) * 9) % 2 === 0) {
      for (let y = gap - upper; y < gap; y += 1) p.px(x, y, STONE.shade)
      for (let y = gap + 1; y <= gap + lower; y += 1) p.px(x, y, STONE.shade)
    }

    p.px(x, gap, ramp.mid)
    p.px(x, gap - 1, ramp.light)
    if (x % 3 === 0) p.px(x, gap, ramp.tip)
  }
  p.outline()
  return p.finish()
}

/**
 * The far shapes. These exist to be read at a hundred metres as dark cut-outs
 * against the haze, so they are designed as silhouettes first: a skyline that
 * still says something with every interior detail thrown away. Their colour is
 * drawn anyway, because the same shapes make good mid-distance scenery.
 */
function spire(rand: () => number): Sprite {
  const p = painter(36, 90)
  const stone = rand() < 0.5 ? STONE_WARM : STONE
  const cx = p.w / 2
  let half = 2 + rand() * 2
  const tops: number[] = []

  for (let y = 2; y < p.h; y++) {
    const k = (y - 2) / (p.h - 2)
    half = 1.5 + Math.pow(k, 1.35) * (p.w / 2 - 3)
    // ledges: a pinnacle that only tapers is a traffic cone
    const step = Math.sin(y * 0.24 + rand() * 0.02) > 0.7 ? 2.5 : 0
    const lean = Math.sin(k * 2.4) * 3
    for (let x = cx - half - step + lean; x <= cx + half + step + lean; x++) {
      const across = (x - (cx - half + lean)) / Math.max(1, half * 2)
      p.px(x, y, across < 0.24 ? stone.light : across > 0.78 ? stone.shade : stone.mid)
    }
    tops[y] = half
  }
  p.outline()
  return p.finish()
}

function ridge(rand: () => number): Sprite {
  const p = painter(128, 58)
  const stone = rand() < 0.5 ? STONE_WARM : STONE
  const peaks = 3 + Math.floor(rand() * 3)
  const centres = Array.from({ length: peaks }, (_, i) => ({
    x: ((i + 0.5) / peaks) * p.w + (rand() - 0.5) * 14,
    h: p.h * (0.45 + rand() * 0.52),
    w: 16 + rand() * 22,
  }))

  for (let x = 1; x < p.w - 1; x++) {
    let top = p.h
    for (const c of centres) {
      const d = Math.abs(x - c.x) / c.w
      if (d > 1) continue
      // a cosine shoulder, flattened at the crest, gives a massif rather than
      // a row of identical cones
      const rise = c.h * Math.pow(Math.cos((d * Math.PI) / 2), 0.7)
      top = Math.min(top, p.h - Math.round(rise))
    }
    const notch = Math.sin(x * 0.42) > 0.85 ? 2 : 0
    for (let y = top + notch; y < p.h; y++) {
      p.px(x, y, y < top + notch + 2 ? stone.light : y > p.h - 5 ? stone.shade : stone.mid)
    }
  }
  p.outline()
  return p.finish()
}

function forest(rand: () => number): Sprite {
  const p = painter(64, 96)
  const ramp = RAMPS[pick(rand, ['jade', 'lime'] as RampName[])]
  const strands = 7 + Math.floor(rand() * 5)
  for (let s = 0; s < strands; s++) {
    const baseX = 4 + rand() * (p.w - 8)
    const amp = 2 + rand() * 5
    const freq = 0.07 + rand() * 0.06
    const top = p.h * (0.02 + rand() * 0.34)
    const phase = rand() * 6.28
    for (let y = p.h - 1; y > top; y--) {
      const k = (p.h - y) / p.h
      const x = baseX + Math.sin(y * freq + phase) * amp * k
      p.px(x, y, ramp.shade)
      p.px(x + 1, y, ramp.mid)
      if (y % 9 === 0) {
        const side = y % 18 === 0 ? 1 : -1
        for (let b = 1; b <= 3 + Math.round(rand() * 3); b++) {
          p.px(x + side * b + (side > 0 ? 1 : 0), y - Math.round(b * 0.5), ramp.light)
        }
      }
    }
  }
  p.outline()
  return p.finish()
}

export type SpriteKind =
  | 'staghorn'
  | 'brain'
  | 'table'
  | 'fan'
  | 'tube'
  | 'barrel'
  | 'bubble'
  | 'polyps'
  | 'toadstool'
  | 'anemone'
  | 'seagrass'
  | 'grass'
  | 'seaweed'
  | 'kelp'
  | 'rock'
  | 'boulder'
  | 'star'
  | 'shell'
  | 'urchin'
  | 'clam'
  | 'spire'
  | 'ridge'
  | 'forest'

const MAKERS: Record<SpriteKind, (rand: () => number) => Sprite> = {
  staghorn,
  brain,
  table,
  fan,
  tube: tubeSponge,
  barrel: barrelSponge,
  bubble,
  polyps,
  toadstool,
  anemone,
  seagrass,
  grass,
  seaweed,
  kelp,
  rock,
  boulder,
  star,
  shell,
  urchin,
  clam,
  spire,
  ridge,
  forest,
}

/** Anything with flesh or a blade in it sways; rock does not, because a swaying rock is a balloon. */
export const SOFT: ReadonlySet<SpriteKind> = new Set<SpriteKind>([
  'staghorn',
  'fan',
  'bubble',
  'toadstool',
  'anemone',
  'seagrass',
  'grass',
  'seaweed',
  'kelp',
  'forest',
  'tube',
])

export function reefSprite(kind: SpriteKind, seed: number): Sprite {
  return MAKERS[kind](rng(seed * 2654435761 + 12345))
}

/** Reachable heights, in metres, so the scatter can size a sprite by what it is. */
export const SPRITE_HEIGHT: Record<SpriteKind, [number, number]> = {
  staghorn: [2.2, 4.4],
  brain: [1.4, 3.0],
  table: [1.6, 3.2],
  fan: [2.6, 5.4],
  tube: [2.2, 4.2],
  barrel: [1.8, 3.4],
  bubble: [1.0, 1.8],
  polyps: [0.7, 1.3],
  toadstool: [1.6, 3.0],
  anemone: [1.2, 2.4],
  seagrass: [1.4, 2.8],
  grass: [0.7, 1.5],
  seaweed: [2.0, 4.0],
  kelp: [4.0, 8.5],
  rock: [1.8, 4.0],
  boulder: [1.4, 3.2],
  star: [0.7, 1.1],
  shell: [0.6, 1.0],
  urchin: [0.7, 1.2],
  clam: [0.8, 1.3],
  spire: [14, 30],
  ridge: [10, 22],
  forest: [10, 20],
}

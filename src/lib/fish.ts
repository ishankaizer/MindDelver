import { pixelCanvas, rng } from './sea'
import type { Sprite } from './sprites'

/**
 * Reef fish, drawn as two frames on one strip so a fish can wag its tail by
 * moving a uv offset instead of by being re-rendered. Two frames is the whole
 * animation: at this size the eye reads the tail flicking between two
 * positions as swimming, and a third frame buys nothing.
 *
 * Species are the ones a reef pack always ships, because they are the ones
 * that stay legible when a fish is twelve pixels long: strong flat body colour,
 * one loud marking, contrasting fins.
 */

const FRAME_W = 26
const FRAME_H = 18
const OUTLINE = '#081A33'

type Pattern = 'bands' | 'split' | 'stripe' | 'bar' | 'spot' | 'plain'

type Species = {
  name: string
  body: string
  belly: string
  back: string
  fin: string
  mark: string
  pattern: Pattern
}

export const SPECIES: Species[] = [
  { name: 'clownfish', body: '#FF9247', belly: '#FFD86B', back: '#C25A1E', fin: '#FF9247', mark: '#FFFFFF', pattern: 'bands' },
  { name: 'blue tang', body: '#1C7CA8', belly: '#2DB6D4', back: '#14527E', fin: '#FFC23D', mark: '#FFC23D', pattern: 'spot' },
  { name: 'butterflyfish', body: '#FFD86B', belly: '#F4EAD2', back: '#FFC23D', fin: '#FFC23D', mark: '#2A3A46', pattern: 'bar' },
  { name: 'green chromis', body: '#2A8F68', belly: '#4FD99A', back: '#1F7A6A', fin: '#4FD99A', mark: '#DCE85C', pattern: 'plain' },
  { name: 'royal gramma', body: '#A97BF0', belly: '#E26EDE', back: '#6B4BA8', fin: '#FFC23D', mark: '#FFC23D', pattern: 'split' },
  { name: 'flame angel', body: '#D1354E', belly: '#FF7A6B', back: '#7A1F33', fin: '#FFC23D', mark: '#7A1F33', pattern: 'stripe' },
  { name: 'cardinalfish', body: '#F4EAD2', belly: '#FFFFFF', back: '#C9B98E', fin: '#4A5560', mark: '#2A3A46', pattern: 'bands' },
  { name: 'sixline wrasse', body: '#6B4BA8', belly: '#A97BF0', back: '#432C6B', fin: '#DCE85C', mark: '#DCE85C', pattern: 'stripe' },
]

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

export function fishSprite(speciesIndex: number, seed: number): Sprite {
  const spec = SPECIES[speciesIndex % SPECIES.length]
  const rand = rng(seed * 40503 + 977)
  const w = FRAME_W * 2
  const h = FRAME_H
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

  // one body, drawn twice, differing only in where the tail is thrown.
  // the extents are kept a cell clear of both frame edges, because the outline
  // pass runs across the whole strip and would otherwise spill one frame's
  // tail into the other frame's cell
  const rx = 7 + rand() * 0.9
  const ry = 4.2 + rand() * 1.1
  const cy = FRAME_H / 2

  for (let f = 0; f < 2; f++) {
    const ox = f * FRAME_W
    const swing = f === 0 ? -1 : 1
    const cx = 16 + swing * 0.5

    // tail: a wedge thrown to one side, which is the frame-to-frame difference
    for (let i = 0; i < 6; i++) {
      const x = cx - rx - i
      const spanTop = cy - 0.6 - i * 0.75 + swing * i * 0.35
      const spanBottom = cy + 0.6 + i * 0.75 + swing * i * 0.35
      for (let y = spanTop; y <= spanBottom; y++) px(ox + x, y, i < 1 ? spec.body : spec.fin)
    }

    // dorsal and anal fins, kept short so the silhouette stays a fish
    for (let i = -3; i <= 3; i++) {
      const up = 2 - Math.abs(i) * 0.4
      for (let j = 0; j < up; j++) px(ox + cx + i - 1, cy - ry - j, spec.fin)
      if (Math.abs(i) < 2) px(ox + cx + i, cy + ry + 1, spec.fin)
    }

    for (let x = -rx; x <= rx; x++) {
      const dx = x / rx
      const hy = ry * Math.sqrt(Math.max(0, 1 - dx * dx))
      for (let y = -hy; y <= hy; y++) {
        const ay = cy + y
        let hex = spec.body
        if (y < -hy * 0.45) hex = spec.back
        else if (y > hy * 0.35) hex = spec.belly

        const alongFront = dx > 0
        if (spec.pattern === 'split' && alongFront) hex = spec.mark
        if (spec.pattern === 'stripe' && Math.abs(y) < 1.1) hex = spec.mark
        if (spec.pattern === 'bands' && (Math.abs(dx - 0.1) < 0.12 || Math.abs(dx + 0.55) < 0.12)) hex = spec.mark
        if (spec.pattern === 'bar' && Math.abs(dx - 0.62) < 0.16) hex = spec.mark
        if (spec.pattern === 'spot' && Math.hypot(dx + 0.45, y / ry) < 0.42) hex = spec.mark

        px(ox + cx + x, ay, hex)
      }
    }

    // pectoral fin over the body, so the fish has a near side
    for (let i = 0; i < 3; i++) px(ox + cx + 1 + i, cy + 1 + (i > 1 ? 1 : 0), spec.fin)

    // the eye is the single most important pixel: without it this is a leaf
    px(ox + cx + rx - 2.5, cy - 1, OUTLINE)
    px(ox + cx + rx - 3.5, cy - 1, '#FFFFFF')
  }

  // outline last, across both frames at once
  const c = rgb(OUTLINE)
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

  ctx.putImageData(img, 0, 0)
  // the aspect describes one frame, not the whole strip: it is what the scene
  // sizes a fish by, and a fish is never two frames wide
  return { canvas, aspect: FRAME_W / FRAME_H }
}

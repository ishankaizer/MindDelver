import * as THREE from 'three'

/**
 * One palette for the whole dive, shared by the shaders, the HUD and the
 * silhouette generators below. Ordered surface to abyss.
 */
export const SEA = {
  foam: '#D7F7F4',
  shallow: '#57DCE6',
  cyan: '#2DB6D4',
  mid: '#1C7CA8',
  deep: '#14527E',
  night: '#0E2E56',
  abyss: '#081A33',
  trench: '#04101F',
  sand: '#E8D9AE',
  sandDeep: '#9E9370',
} as const

/** Facet hues are reef life: they have to read against a blue field. */
export const REEF = {
  pearl: '#CFEFF2',
  kelp: '#4FD99A',
  anemone: '#FF6F9F',
  coral: '#FF9247',
  urchin: '#A97BF0',
  algae: '#DCE85C',
} as const

type Cell = (x: number, y: number) => void

function pixelCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx }
}

function toTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas)
  // the entire point is that the grid survives being blown up to eight metres
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** Deterministic, so a reef looks the same on every reload of the same brief. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

/**
 * A branching coral drawn one cell at a time, the way the reference sprites
 * are: a trunk that splits, each limb thinner and shorter than its parent.
 * Drawn as a flat silhouette because at this distance a coral is a shape.
 */
function drawBranch(
  cell: Cell,
  x: number,
  y: number,
  angle: number,
  len: number,
  thick: number,
  depth: number,
  rand: () => number,
) {
  let cx = x
  let cy = y
  for (let i = 0; i < len; i++) {
    const wobble = (rand() - 0.5) * 0.35
    cx += Math.cos(angle + wobble)
    cy += Math.sin(angle + wobble)
    const t = Math.max(1, Math.round(thick))
    for (let ox = 0; ox < t; ox++) {
      for (let oy = 0; oy < t; oy++) {
        cell(Math.round(cx) + ox - (t >> 1), Math.round(cy) + oy - (t >> 1))
      }
    }
    if (depth > 0 && i > len * 0.35 && rand() < 0.14) {
      const side = rand() < 0.5 ? 1 : -1
      drawBranch(
        cell,
        cx,
        cy,
        angle + side * (0.5 + rand() * 0.5),
        len * (0.45 + rand() * 0.25),
        thick * 0.7,
        depth - 1,
        rand,
      )
    }
  }
}

export function coralTexture(seed: number, size = 48): THREE.Texture {
  const { canvas, ctx } = pixelCanvas(size, size)
  const rand = rng(seed)
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#ffffff'
  const cell: Cell = (x, y) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    ctx.fillRect(x, y, 1, 1)
  }
  const trunks = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < trunks; i++) {
    const base = size * (0.3 + rand() * 0.4)
    drawBranch(
      cell,
      base,
      size - 1,
      -Math.PI / 2 + (rand() - 0.5) * 0.7,
      size * (0.45 + rand() * 0.4),
      3.2,
      3,
      rand,
    )
  }
  return toTexture(canvas)
}

/**
 * Rock outcrops with flat terraces. The terraces are the tell: the reference
 * art never uses a smooth slope, it stacks ledges, and that is what stops a
 * silhouette reading as a blurred lump once it is scaled up.
 */
export function rockTexture(seed: number, w = 64, h = 40): THREE.Texture {
  const { canvas, ctx } = pixelCanvas(w, h)
  const rand = rng(seed)
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#ffffff'

  let level = h * (0.7 + rand() * 0.3)
  let hold = 0
  for (let x = 0; x < w; x++) {
    if (hold <= 0) {
      hold = 3 + Math.floor(rand() * 9)
      const step = Math.round((rand() - 0.45) * h * 0.22)
      level = Math.max(3, Math.min(h - 2, level + step))
    }
    hold--
    // the terraces alone give a skyline; a dome envelope over them is what
    // turns the same silhouette back into an outcrop sitting on a seabed
    const dome = Math.pow(Math.sin((Math.PI * (x + 0.5)) / w), 0.55)
    const top = h - Math.round(level * dome)
    if (top < h) ctx.fillRect(x, top, 1, h - top)
  }
  return toTexture(canvas)
}

/** Kelp: slow sine strands, thicker at the base, fraying at the tip. */
export function kelpTexture(seed: number, w = 32, h = 64): THREE.Texture {
  const { canvas, ctx } = pixelCanvas(w, h)
  const rand = rng(seed)
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#ffffff'

  const strands = 2 + Math.floor(rand() * 3)
  for (let s = 0; s < strands; s++) {
    const baseX = w * (0.2 + rand() * 0.6)
    const amp = 2 + rand() * 5
    const freq = 0.12 + rand() * 0.1
    const top = h * (0.05 + rand() * 0.3)
    const phase = rand() * 6.28
    for (let y = h - 1; y > top; y--) {
      const k = (h - y) / h
      const x = Math.round(baseX + Math.sin(y * freq + phase) * amp * k)
      const t = k < 0.8 ? 2 : 1
      ctx.fillRect(x, y, t, 1)
      if (rand() < 0.08) ctx.fillRect(x + (rand() < 0.5 ? -2 : 2), y, 1, 1)
    }
  }
  return toTexture(canvas)
}

import * as THREE from 'three'

/**
 * One palette for the whole dive, shared by the shaders, the HUD and the
 * sprite generators. Ordered surface to abyss.
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

/**
 * Everything that sits on the seabed measures from here. High enough that the
 * reef is in frame at the default camera rather than a strip along the bottom
 * edge, low enough that the coral still has room to grow above it.
 */
export const FLOOR_Y = -12

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

export function pixelCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  return { canvas, ctx }
}

export function toTexture(canvas: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(canvas)
  // the entire point is that the grid survives being blown up to eight metres
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.generateMipmaps = false
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

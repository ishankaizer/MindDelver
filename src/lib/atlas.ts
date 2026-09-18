import * as THREE from 'three'
import { pixelCanvas, toTexture } from './sea'
import type { Sprite } from './sprites'

/**
 * Every sprite in the dive, packed into one texture.
 *
 * This is the whole reason the reef can afford to be dense. A sprite per
 * texture means a material per sprite and therefore a draw call per piece of
 * coral, and a thousand draw calls is where the frame budget goes. One atlas
 * means one material, which means the entire seabed can be drawn instanced in
 * a single call no matter how many pieces are standing in it.
 *
 * A plain shelf packer is enough: the sprites are all within a few cells of
 * each other in height, which is the case shelf packing handles well.
 */

export type Frame = {
  /** uv rect within the atlas: origin and span. */
  u: number
  v: number
  w: number
  h: number
  aspect: number
}

export type Atlas = { texture: THREE.Texture; frames: Frame[] }

const PAD = 2

function nextPow2(n: number) {
  let p = 1
  while (p < n) p *= 2
  return p
}

export function buildAtlas(sprites: Sprite[], maxWidth = 1024): Atlas {
  const placed: { x: number; y: number; sprite: Sprite }[] = []
  let penX = PAD
  let penY = PAD
  let shelfHeight = 0
  let usedWidth = 0

  // tallest first, so short sprites fill in under the tall ones instead of
  // each starting a shelf of its own
  const order = sprites
    .map((sprite, index) => ({ sprite, index }))
    .sort((a, b) => b.sprite.canvas.height - a.sprite.canvas.height)

  const spots = new Array<{ x: number; y: number }>(sprites.length)

  for (const { sprite, index } of order) {
    const w = sprite.canvas.width
    const h = sprite.canvas.height
    if (penX + w + PAD > maxWidth) {
      penX = PAD
      penY += shelfHeight + PAD
      shelfHeight = 0
    }
    spots[index] = { x: penX, y: penY }
    placed.push({ x: penX, y: penY, sprite })
    penX += w + PAD
    shelfHeight = Math.max(shelfHeight, h)
    usedWidth = Math.max(usedWidth, penX)
  }

  const width = nextPow2(Math.min(maxWidth, usedWidth + PAD))
  const height = nextPow2(penY + shelfHeight + PAD)
  const { canvas, ctx } = pixelCanvas(width, height)
  for (const { x, y, sprite } of placed) ctx.drawImage(sprite.canvas, x, y)

  // v counts up from the bottom because CanvasTexture uploads with flipY on,
  // while the packer lays sprites out top-down. Getting this backwards plants
  // the whole reef upside down, which is not subtle but is easy to write
  const frames = sprites.map((sprite, i) => ({
    u: spots[i].x / width,
    v: 1 - (spots[i].y + sprite.canvas.height) / height,
    w: sprite.canvas.width / width,
    h: sprite.canvas.height / height,
    aspect: sprite.aspect,
  }))

  return { texture: toTexture(canvas), frames }
}

import { buildAtlas, type Atlas } from './atlas'
import { SPECIES, fishSprite } from './fish'
import { type Sprite, type SpriteKind, reefSprite } from './sprites'

/**
 * The whole cast, generated once and packed into one atlas.
 *
 * Built lazily at module scope rather than per component: the reef and the
 * fish draw from the same texture, and generating it twice would both double
 * the startup cost and put two copies on the GPU for no reason.
 */

/** How many distinct cuts of each kind to generate. Variety costs one canvas each. */
const VARIANTS: Record<SpriteKind, number> = {
  staghorn: 6,
  brain: 5,
  table: 5,
  fan: 6,
  tube: 5,
  barrel: 4,
  bubble: 4,
  polyps: 4,
  toadstool: 4,
  anemone: 5,
  seagrass: 5,
  grass: 6,
  seaweed: 5,
  kelp: 5,
  rock: 6,
  boulder: 5,
  star: 3,
  shell: 3,
  urchin: 3,
  clam: 3,
  spire: 4,
  ridge: 4,
  forest: 4,
}

export type Library = {
  atlas: Atlas
  /** frame indices in the atlas, by kind */
  frames: Record<SpriteKind, number[]>
  /** frame index of each fish species strip */
  fish: number[]
}

let cached: Library | null = null

export function reefLibrary(): Library {
  if (cached) return cached

  const sprites: Sprite[] = []
  const frames = {} as Record<SpriteKind, number[]>

  const kinds = Object.keys(VARIANTS) as SpriteKind[]
  kinds.forEach((kind, k) => {
    const list: number[] = []
    for (let v = 0; v < VARIANTS[kind]; v++) {
      list.push(sprites.length)
      sprites.push(reefSprite(kind, k * 7919 + v * 104729 + 17))
    }
    frames[kind] = list
  })

  const fish = SPECIES.map((_, i) => {
    const index = sprites.length
    sprites.push(fishSprite(i, i * 31 + 7))
    return index
  })

  cached = { atlas: buildAtlas(sprites), frames, fish }
  return cached
}

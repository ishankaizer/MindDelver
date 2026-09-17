import type { FacetId } from './facets'

export type Sprout = {
  label: string
  facet: FacetId
  note?: string
}

/**
 * Hand-authored stand-in for the model. Keys are lowercased node labels.
 * Swapping in a real model means replacing lookups in brain.ts, nothing else.
 */
export const BRAIN: Record<string, Sprout[]> = {
  mysore: [
    { label: 'Dasara elephants', facet: 'sense', note: 'the lead tusker carries a 750kg golden howdah through the city' },
    { label: 'Mysore Palace', facet: 'sense', note: 'Indo-Saracenic domes, 97,000 bulbs switched on at once' },
    { label: 'sandalwood', facet: 'part', note: 'the state tree, oil pressed from heartwood, historically crown property' },
    { label: 'Mysore silk', facet: 'part', note: 'pure mulberry, weighted with real zari gold in the border' },
    { label: 'Mysore Pak', facet: 'quality', note: 'gram flour, ghee, sugar. porous, collapses into sand in the mouth' },
    { label: 'rosewood inlay', facet: 'part', note: 'Mysore marquetry, pale figures set into near-black wood' },
    { label: 'Chamundi Hill', facet: 'kind', note: '1008 steps up, a Nandi bull carved from a single boulder halfway' },
    { label: 'city of palaces', facet: 'context' },
    { label: 'the ceremonial umbrella', facet: 'sideways', note: 'rank in the procession is read off the parasols, not the people' },
  ],
  golf: [
    { label: 'the green', facet: 'sense', note: 'the only part of the course that is truly controlled' },
    { label: 'sand bunker', facet: 'sense', note: 'a hazard shaped like a beach, raked into stillness every evening' },
    { label: 'the rough', facet: 'context', note: 'the game names its own difficulty as terrain' },
    { label: 'birdie, eagle, albatross', facet: 'context', note: 'the entire scoring vocabulary is birds, getting rarer as you get better' },
    { label: 'the iron', facet: 'part', note: 'forged head, graduated lofts, a family of near-identical siblings' },
    { label: 'the swing arc', facet: 'kind', note: 'coil, release, and a follow-through that is held like a pose' },
    { label: 'the divot', facet: 'kind', note: 'a scar you are expected to replace and press back down' },
    { label: 'the tee', facet: 'kind', note: 'a tiny plinth whose only job is to raise something for a moment' },
    { label: 'the dimples', facet: 'sideways', note: '336 flaws on the ball. it flies further because its surface is damaged' },
    { label: 'the handicap', facet: 'sideways', note: 'a sport that formalises your weakness so you can be fairly beaten' },
  ],
  trophy: [
    { label: 'the plinth', facet: 'sense', note: 'the part nobody photographs and everybody grips' },
    { label: 'engraved nameplate', facet: 'sense', note: 'the only part that changes, added later, by someone else' },
    { label: 'the cup', facet: 'kind', note: 'an open vessel. it wins by being empty' },
    { label: 'lifted overhead', facet: 'kind', note: 'designed for one gesture it performs for four seconds' },
    { label: 'brass and bronze', facet: 'part', note: 'alloys chosen because they age instead of staying new' },
    { label: 'patina', facet: 'quality', note: 'the finish that only arrives if you let it be handled' },
    { label: 'silverware', facet: 'context', note: 'an entire category of glory named after cutlery' },
    { label: 'the perpetual trophy', facet: 'sideways', note: 'you never own it. you hold it a year and hand it back' },
  ],

  'dasara elephants': [
    { label: 'the howdah', facet: 'part', note: 'gold over wood, the weight is the point' },
    { label: 'anklet bells', facet: 'quality', note: 'you hear the procession a street before you see it' },
    { label: 'painted forehead', facet: 'quality', note: 'chalk and pigment, redrawn every morning of the ten days' },
    { label: 'the caparison', facet: 'part', note: 'embroidered cloth that makes the animal architectural' },
    { label: 'slow weight', facet: 'kind', note: 'the whole spectacle is built on something that cannot hurry' },
    { label: 'the lead tusker is chosen, not owned', facet: 'sideways', note: 'a title passed between elephants across years' },
  ],
  sandalwood: [
    { label: 'heartwood', facet: 'part', note: 'only the dead centre of the tree is worth anything' },
    { label: 'the smell warms on skin', facet: 'quality', note: 'it needs body heat to actually release' },
    { label: 'pale cream turning honey', facet: 'quality' },
    { label: 'carved lattice', facet: 'kind', note: 'jali screens, cut so thin they become light' },
    { label: 'thirty years to maturity', facet: 'sideways', note: 'a material nobody plants for themselves' },
    { label: 'the tree was owned by the crown', facet: 'sense', note: 'you could grow it but not cut it' },
  ],
  'the iron': [
    { label: 'forged vs cast', facet: 'part', note: 'grain structure you cannot see but can feel at impact' },
    { label: 'loft angle', facet: 'kind', note: 'a family of tools that differ only by a few degrees' },
    { label: 'the sweet spot', facet: 'quality', note: 'a zone the size of a coin that tells you through your hands' },
    { label: 'blackened, blued, chromed', facet: 'part' },
    { label: 'striking it well sounds nothing like striking it badly', facet: 'quality' },
    { label: 'irons are numbered but the numbers are not sizes', facet: 'sideways' },
  ],
  'the green': [
    { label: 'mown in stripes', facet: 'kind', note: 'the pattern is only bent light, the grass is all one length' },
    { label: 'reading the break', facet: 'context', note: 'a skill that is entirely about seeing slope' },
    { label: 'the flagstick', facet: 'kind', note: 'a vertical line placed to be removed' },
    { label: 'grass cut to 3mm', facet: 'quality' },
    { label: 'contour lines', facet: 'kind', note: 'the green is a topographic drawing you walk on' },
    { label: 'the hole is 108mm, everywhere on earth', facet: 'sideways' },
  ],
  'sand bunker': [
    { label: 'rake marks', facet: 'kind', note: 'parallel grooves, a zen garden that exists to be ruined' },
    { label: 'the lip', facet: 'kind', note: 'the edge is the whole difficulty' },
    { label: 'explosion shot', facet: 'context', note: 'you never hit the ball, you hit the sand under it' },
    { label: 'white silica', facet: 'part' },
    { label: 'the sound is a thud, not a click', facet: 'quality' },
    { label: 'you may not ground your club in it', facet: 'sideways', note: 'a hazard defined by what you are forbidden to touch' },
  ],
  'the cup': [
    { label: 'two handles', facet: 'kind', note: 'shaped for a gesture, not for a hand' },
    { label: 'the interior nobody sees', facet: 'sideways' },
    { label: 'spun, not cast', facet: 'part', note: 'metal pushed over a wooden form on a lathe' },
    { label: 'the lip rolls outward', facet: 'kind' },
    { label: 'it echoes when you knock it', facet: 'quality' },
    { label: 'a vessel for drinking made unusable by winning', facet: 'context' },
  ],
  patina: [
    { label: 'verdigris', facet: 'quality', note: 'copper going green, the only decay we call beautiful' },
    { label: 'handled edges stay bright', facet: 'kind', note: 'wear writes a map of where people touch' },
    { label: 'lacquered to stop it', facet: 'part', note: 'most trophies are sealed against the thing that would make them interesting' },
    { label: 'tarnish', facet: 'sense' },
    { label: 'the object records its own history', facet: 'context' },
    { label: 'you can force it with vinegar in a day', facet: 'sideways' },
  ],
  'mysore pak': [
    { label: 'porous crumb', facet: 'kind', note: 'an open cell structure, almost a foam' },
    { label: 'ghee', facet: 'part', note: 'the fat is the ingredient, not the medium' },
    { label: 'cut into slabs while warm', facet: 'kind' },
    { label: 'it collapses rather than breaks', facet: 'quality' },
    { label: 'invented in the palace kitchen', facet: 'sense', note: 'a royal cook improvising, and it kept the city name' },
    { label: 'a sweet named after a place, not a person', facet: 'sideways' },
  ],
  'the plinth': [
    { label: 'weighted deliberately', facet: 'part', note: 'heft is faked on purpose, cost is judged by mass' },
    { label: 'felt underside', facet: 'quality' },
    { label: 'stepped profile', facet: 'kind' },
    { label: 'the base outlives the thing on top', facet: 'context' },
    { label: 'black granite as default', facet: 'part', note: 'the most-used and least-considered material in the category' },
    { label: 'it is a pedestal, which is also a verb', facet: 'sideways' },
  ],
  'the swing arc': [
    { label: 'the plane', facet: 'kind', note: 'coaches describe a swing as a tilted disc in space' },
    { label: 'coil and release', facet: 'kind' },
    { label: 'held follow-through', facet: 'context', note: 'the pose after the act is how the act is judged' },
    { label: 'a sweep, not a hit', facet: 'quality' },
    { label: 'the clubhead travels faster than the hands', facet: 'sideways' },
    { label: 'traced as a single continuous line', facet: 'kind', note: 'photograph it long exposure and it becomes a ribbon' },
  ],
  'mysore silk': [
    { label: 'zari border', facet: 'part', note: 'real gold-wrapped thread, the weight is in the edge' },
    { label: 'it has a sound', facet: 'quality', note: 'raw silk crunches faintly, the test for real' },
    { label: 'double shot colour', facet: 'quality', note: 'warp one colour, weft another, so it shifts as you turn it' },
    { label: 'the loom', facet: 'kind' },
    { label: 'weighted drape', facet: 'kind' },
    { label: 'the government runs the factory', facet: 'sideways' },
  ],
}

/**
 * A few pairings worth having a real answer for. Keys are sorted labels joined by '+'.
 */
export const FUSIONS: Record<string, { title: string; body: string }> = {
  'sandalwood+the iron': {
    title: 'The scented grip',
    body: 'A forged iron head with a sandalwood core in the shaft. It only gives off scent once the player has held it long enough to warm it. The trophy version: an iron form you have to hold to activate.',
  },
  'patina+the iron': {
    title: 'Won-in finish',
    body: 'Cast the trophy in unlacquered bronze and leave the grip zone unsealed, so a year of being handled polishes it bright while the rest goes dark. Every holder leaves the next one a different object.',
  },
  'dasara elephants+the swing arc': {
    title: 'Slow weight, fast line',
    body: 'One continuous swept ribbon, the exact path of a clubhead, rendered at the scale and mass of a processional tusker. Massive at the base, thinning to nothing at the tip. It reads as speed only from one angle.',
  },
  'sand bunker+rake marks': {
    title: 'The raked plinth',
    body: 'A base of white silica-blasted stone with parallel rake grooves cut into it, with the trophy body rising out of the sand like the moment before an explosion shot.',
  },
  'the cup+mysore pak': {
    title: 'Cast crumb',
    body: 'A vessel with the open porous cell structure of Mysore Pak, cast in bronze by burning out an actual piece of it. A cup you cannot drink from because it is full of holes.',
  },
  'sandalwood+the green': {
    title: 'Contour stack',
    body: 'Stack sandalwood sheets as topographic contours of the club\'s signature green, laminated and carved back. The trophy is a slice of the actual ground the tournament was won on, and it smells of it.',
  },
}


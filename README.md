# Bhulandar

A 3D spatial brainstorming tool. You plant a brief, it branches into a coral
sculpture of everything the words in that brief can mean, and you pull branches
together to get concepts you would not have reached on your own.

Built by Ishan (@ishankaizer). Local path `X:\CLAUDE\Bhulandar`, remote
`https://github.com/ishankaizer/MindDelver.git`, branch `master`.

---

## Why it exists

The problem it solves is going narrow. You get a brief, you think of the three
obvious things, and you build one of them. Bhulandar exists to make the space
around a brief visible before you commit to any of it.

The worked example, which is the one to test against: **a golf trophy for a golf
club in Mysore**. A good run surfaces elephants and Mysore Pak off "mysore", and
bunkers, tees, greens and the whole bird-name scoring vocabulary off "golf".

**Breadth is the feature, not volume.** More nodes that all say the same thing is
a failure. Six nodes that disagree with each other is a success.

## The loop

1. **Seed.** Type a brief. It is split into terms and planted.
2. **Sprawl.** Each term branches in 3D across six facets (below).
3. **Fuse.** Add two or three nodes to "the mix" and combine them. This is
   explicitly Little Alchemy logic: two things crossed give a third thing.
4. **Harvest.** Pull image references for what you landed on. **Not built yet.**
   This is the only stage that needs a scraper, and it is the last stage, not
   the first. The project started life as a request for a Pinterest / Google
   Images scraper, and that framing is misleading: the scraper is a footnote.

## The six facets

Defined in `src/lib/facets.ts`. Every expansion sprouts across all six, colour
coded. This is the anti-narrowness mechanic and **must not be replaced with a
flat list of related words.**

| id | label | what it asks | colour |
|---|---|---|---|
| `sense` | means | every thing the word can mean | `#EADCC8` bone |
| `kind` | kinds | narrower and wider than it | `#4FD99A` sea green |
| `quality` | qualities | how it gets described | `#FF6F9F` anemone pink |
| `part` | parts | what it is made of, what it belongs to | `#FF9247` coral orange |
| `context` | nearby | what it drags in, read against your brief | `#A97BF0` urchin purple |
| `sideways` | sideways | the same word **ignoring** your brief | `#DCE85C` algae lime |

`sideways` is deliberately unbiased. Do not "improve" it by feeding it the
brief. Its whole job is to be the one facet that is not trying to be relevant.

The facet colours are reef life on purpose, so they read against blue water.

## Running it

```
npm install
npm run dev      # port 5180, Vite falls through to 5181 if a stale process holds it
npm run build    # tsc -b && vite build
npm run preview
```

No API key is needed for anything except the optional LLM upgrade to fusion.

## Controls

A permanent control bar sits at the bottom, and `?` opens a full "how to dive"
overlay which auto-opens once on the first ever planted brief. **Do not hide the
controls again.** Shift-click alone was undiscoverable, which is why adding to
the mix is reachable three ways.

| key | does |
|---|---|
| `enter` | branch out from the selected node |
| `m` | add selected to the mix (also shift-click, also right-click) |
| `c` | combine what is in the mix |
| `x` | clear the mix |
| `p` | cycle pixel grade (`pixel` / `soft` / `clean`, stored in localStorage) |
| `n` | new brief |
| `esc` | deselect |
| `?` | the full guide |

Drag to swim. **Hovering a sphere is how you read an unlabelled node**, which is
why the hint line says so.

### Touch (phone / tablet)

Nothing about the interaction model changes for touch: a tap fires the same
`onClick` a mouse click does, so tap-to-select-and-branch and the detail
card's "add to mix" / "branch out" buttons already worked before anything
below existed. What did not work was the layout and the copy, both of which
assumed a mouse and a wide screen:

- One finger drags to orbit, two fingers pinch to dolly, matching
  `OrbitControls`' `touches` config set explicitly in `Scene.tsx` (`ONE:
  ROTATE, TWO: DOLLY_PAN`) rather than relying on its defaults.
- A held press fires `onContextMenu` on mobile browsers same as a
  right-click does on desktop, so it still adds to the mix as a secondary
  path; the primary path on touch is the detail card's button, since
  there is no shift key.
- `usePointerCoarse()` in `Guide.tsx` (`matchMedia('(pointer: coarse)')`)
  swaps the guide's and control bar's copy from "shift-click" / "hover" /
  "right-click" to "hold" / "tap" / touch-only rows, since none of the
  mouse-only verbs exist on a phone.
- `.hud__top` (brief + legend) and `.hud__dock` (detail + mix tray +
  control bar) are new wrapper divs in `Hud.tsx` that do nothing on
  desktop, but below 680px become the only positioned elements and their
  children go `position: static` and stack in a column. Without this the
  four corner panels, each absolutely positioned for a wide screen,
  physically overlap on a phone.
- `index.html`'s viewport meta gained `maximum-scale=1, user-scalable=no,
  viewport-fit=cover`: native pinch-zoom would otherwise fight
  `OrbitControls`' own pinch-to-dolly, and `viewport-fit=cover` plus
  `env(safe-area-inset-*)` padding on the two docks keeps them off a
  notch or home-indicator.

---

## Architecture

Vite + React + TypeScript, react-three-fiber + drei, zustand, framer-motion,
`@react-three/postprocessing`.

### The brain (live word data, not hand authored)

- `src/lib/sources/datamuse.ts` hits `api.datamuse.com` (free, no key), one
  query per facet. `clean()` strips thesaurus junk ("thingamajig", "artifact")
  and morphological variants of the word you already have.
- `src/lib/senses.ts` turns dictionary glosses into readable node labels and
  picks senses that are **far apart**, including a figurative one.
- `src/lib/brain.ts` is the orchestrator: `sprout()`, `fuse()`, `seedTerms()`.
- `src/lib/brainData.ts` holds a small curated `BRAIN` / `FUSIONS` prior that
  seeds the first few children when a term happens to be covered.
- `src/lib/sources/llm.ts` is **optional**. Ishan has no Anthropic API key, only
  the Claude Pro chat subscription, so nothing may depend on an LLM. A Gemini or
  Anthropic key pasted into the HUD is kept in localStorage and only upgrades
  fusion from "here is the semantic crossing" to a written concept.

### The sculpture

- `src/lib/growth.ts` tapered tubes, branch curves, and the fan logic.
- `src/components/Limb.tsx`, `Blob.tsx`, `FusionLayer.tsx`.
- `src/store/useGraph.ts` zustand store, `SEED_ID`, `PIXEL_GRADES`,
  `worldPosition()`.

**Spatial form is decided: living growth / coral.** Tapered tubes growing from a
central seed, springy sway, the camera orbits one sculpture. This was picked
over a free-floating constellation and over flat depth planes. **Do not redesign
it without asking.**

### The reef (the world it grows in)

- `src/lib/sea.ts` the `SEA` palette, `FLOOR_Y = -12`, the seeded `rng()`, and
  the canvas/texture helpers. **No assets are ever shipped.** Everything is
  generated at runtime at `NearestFilter`.
- `src/lib/sprites.ts` the cast: 23 generators (`SpriteKind`) painted in full
  colour from three-tone ramps, plus `SPRITE_HEIGHT` and the `SOFT` set of
  things that sway.
- `src/lib/atlas.ts` shelf-packs every generated sprite into one texture.
- `src/lib/reefLibrary.ts` generates the whole cast once at module scope.
- `src/components/ReefField.tsx` one instanced quad for everything standing on
  the sand.
- `src/components/Reef.tsx` the seafloor caustic shader, the lit mounds, and the
  layer definitions that place roughly 1200 pieces.
- `src/lib/fish.ts` + `src/components/Fish.tsx` eight species as two-frame
  strips, one species per shoal.
- `src/components/Atmosphere.tsx` backdrop sphere, god rays, lit ceiling, and
  the near-field shaft planes.
- `src/components/PixelPass.tsx` the pixel pass, last in the composer.

Composer chain order is **Bloom, ToneMapping, Vignette, then the pixel pass
last.** The composer forces `NoToneMapping` on the renderer, so without the
explicit ToneMapping the frame blows out.

### Visual direction

**Underwater pixel art.** Deep blue and teal water, god rays, dithered
gradients, real parallax. Every reference Ishan gave was a pixel-art underwater
game. The old warm amber and paper look is gone; **do not bring it back.**

Two growth themes are planned. Underwater is being built out fully first.
**Mushroom is the planned second.**

---

## Hard-won lessons: do not relearn these

Each of these cost real time at least once.

**Palette**

- The pixel pass snaps colour to a **fixed palette**, not to per-channel levels.
  The palette is what makes it read as pixel art. Going back to levels turns it
  into noise.
- The palette is organised as **ramps** (water, sand and stone, then three tones
  per living hue) and the sprite generators paint straight out of those entries
  **on purpose**. A colour the palette cannot say gets dragged onto some
  unrelated swatch and its shading collapses flat. **Add a colour to a sprite,
  add its ramp to the palette.**
- **Never paint anything that is not water in a water blue.** This applies to
  the generated sprites *and* to real lit geometry. The seed pedestal and the
  seabed mounds were both deep blue once, so the pixel pass quantised every face
  of them onto a water swatch and the rock the whole reef is anchored to read as
  a hole cut out of the reef. Stone comes from the stone ramp:
  `#8a8a78` / `#4a5560` / `#2a3a46`.

**Geometry and lighting**

- The key light is a **single directional from overhead**, so only upward-facing
  faces catch it. A stack of spheres presents almost none of them and comes back
  black. Flatten anything that needs to read as lit rock.
- The backdrop sphere must use `side={THREE.BackSide}`. The older
  `scale={[-1,1,1]}` trick silently rendered nothing.
- Distance is fog plus a **light** cool tint. A `color` multiply can only
  darken, so tinting hard turns the horizon black instead of hazy.

**The reef**

- **Everything standing on the sand is one draw call.** The cost of this scene
  is draw calls and per-frame CPU work, not triangles. `ReefField`'s vertex
  shader does the billboarding, swaying and fogging from per-instance attributes
  uploaded once, leaving the clock as the only per-frame uniform. A
  mesh-per-sprite scene will not carry this reef. **Do not go back to one.**
- Billboard **around Y only**. Facing the camera fully tips the sprites as the
  camera rises and the reef looks like it is falling over.
- The alpha test is a hard `discard`, not blending. That is what keeps the pixel
  edge crisp *and* removes the need to depth sort, which is what allows one call.
- **A per-step random split chance compounds into thousands of twigs.** The sea
  fan needs fixed generations plus a `weave` pass to read as a net rather than a
  tree.
- A sprite's `aspect` travels with it, so nothing ever gets stretched.
- The `painter` helper's alpha channel doubles as the outline mask.
- **Placement clumps into thickets.** An even scatter is the one distribution a
  reef never has: it reads as a lawn. The gaps are what make density feel placed.
- Fish sizes are judged against the coral sculpture, not against a real fish.

**Labels** (solved 2026-09-16, do not undo)

- Branches fan on an even ring with a hard minimum angle off the parent axis
  (`growth.ts`).
- Sense labels are cut to a four-word head phrase, with the full gloss kept for
  the detail panel (`senses.ts`).
- `src/lib/labels.ts` runs a screen-space de-confliction pass, so overlapping
  labels lose by priority instead of stacking.
- **A label is earned:** the first ring always, then only the selected node, its
  children, its path back, and anything hovered.
- Node labels are drei `<Html>`, and their `zIndexRange` has to stay under the
  HUD's z ramp or a label paints over the guide overlay.

---

## Working agreements

- **Build a rough thin slice of everything early**, so the whole picture is
  visible and can be redirected, rather than polishing one part first. Verbatim:
  *"i might change directions a little here and there and itll be better if done
  early rather than finihsing it right."*
- **Go big.** On Bhulandar, commit fully to a reference-driven direction. This is
  the deliberate opposite of the portfolio's restraint.
- **Commit before any risky redesign.**
- **Push to `origin master` to deploy.**
- **No em dashes** in anything written for Ishan.
- **Update `README.md` and `JOURNAL.md` continuously, not just at the end of a
  session** so the next session starts from everything already learned even if
  this one gets cut off first. See `CLAUDE.md`.
- **From 2026-09-18, Ishan is working from his phone for a while**, with no
  laptop session in between. GitHub is the only copy of this project's state
  and reasoning that is guaranteed to persist between sessions. Commit and push
  early and often, not once at the end.

## Not built yet

- **Harvest / image scraping.** The final stage of the loop.
- **The mushroom theme.** The second growth theme, after underwater.

## Known open questions

- The reef is now dense and colourful enough to compete with the concept tree
  for attention, and at some camera angles a distance-band sprite swings past as
  a large grey wall. Options if it becomes a problem: desaturate the outer bands,
  drop thicket density near the centre while keeping it high further out, or lift
  the limb material's brightness so the ideas stay the loudest thing on screen.
  Raised 2026-09-18, not yet decided.

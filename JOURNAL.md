# Journal

One entry per working session, newest first. The durable knowledge belongs in
`README.md`; this file is the record of how it got there and what was decided.

A good entry says what changed, **why**, what was tried and rejected, and what
the next session should pick up. If a session taught a lesson that must not be
relearned, put the lesson in the README's "Hard-won lessons" and note here that
you did.

---

## 2026-09-18 (seventh session): pushed to master, legend was too tall

Pushed the mobile + PWA work to `origin master` at Ishan's go-ahead (Vercel
is already connected and watches that branch). Fast-forward merge, no
conflicts. Then Ishan opened the live site (`divien.vercel.app`) on his
phone and sent a screenshot: layout was structurally correct - top dock and
bottom dock both stacking exactly as designed, nothing overlapping - but the
legend, stacked at full width with all six facet rows plus the model-key
control, was eating close to 40% of the screen and squeezing the reef into
a thin middle strip. True on a phone in a way it never was in the corner-box
desktop layout, which is why the first mobile pass missed it: shrinking a
corner panel and stacking a panel at full width are different problems.

Fixed by collapsing the legend behind a `facets` toggle on mobile, closed by
default. `KeySlot` right next to it already used exactly this pattern
(closed by default, opens on tap), so this is really the same idea applied
one level up.

**Also learned this session:** this sandbox's network egress is an
allowlist (npm, PyPI, Anthropic's own endpoints, a few others), not a
default-allow with exceptions - `divien.vercel.app` is blocked outright, so
neither `WebFetch` nor a plain `curl` can reach the live site from here.
Verifying a deploy from inside this container is not possible; it has to be
Ishan checking the real URL on a real device, which is also the more honest
test anyway since PWA install prompts are Chrome-proprietary and don't fire
in the sandbox's open-source Chromium regardless.

Verified this fix with `npm run dev` at a 390px touch-emulated viewport:
collapsed state shows the reef almost full-height, `facets` tap opens the
full legend over it.

---

## 2026-09-18 (sixth session): installable PWA

Follow-up to the mobile pass: asked to add a manifest so the app installs to
a home screen, which the previous session had flagged as raised-but-not-done.

**What changed:**
- `public/manifest.webmanifest`: standalone display, trench background and
  theme colour, three icon entries (192, 512, and a maskable 512).
- `public/sw.js`: registered from `main.tsx`, production builds only. It
  caches the app shell (same-origin GETs, stale-while-revalidate) and
  explicitly leaves every cross-origin request alone. This was a deliberate
  line: the app's "brain" is a live Datamuse lookup, optionally upgraded by
  a pasted LLM key, so a service worker that cached growth results would
  make the tool answer offline sessions with the same stale branches every
  time, which is exactly the narrowness the whole tool exists to avoid.
  Caching the shell but never the word data was the right split.
- `tools/generate-icons.mjs`: a dependency-free script (own PNG encoder,
  `zlib.deflateSync` for compression, no canvas/sharp/imagemagick, since
  none were available in this container and none should be a build
  dependency for four static files) that paints the bioluminescent seed and
  its six facet-coloured limbs in the actual game palette, then
  nearest-neighbour scales it into every required icon size. First pass had
  the maskable icon showing a visible rectangle where the two-tone trench/
  abyss background band got cropped mid-gradient by the OS's circle mask;
  fixed by giving the maskable variant a flat trench background instead of
  the gradient.
- Noted in the README that shipping these PNGs does not contradict "no
  assets are ever shipped": that rule is about the reef itself staying
  procedural, not about app chrome, and a PWA icon has to exist as a static
  file before any JS can generate anything.

**Verified.** `npm run build`, then `vite preview` with the headless
Chromium, fetching the manifest and every icon URL it lists (200,
`image/png`, non-zero bytes) and checking `navigator.serviceWorker
.getRegistration()` reached `state: 'activated'` with no console errors.

---

## 2026-09-18 (fifth session): mobile pass

Asked to make the whole app work on a phone, controls included. Checked first:
the actual interaction logic (`Blob.tsx`'s `onClick`) already worked on touch,
since a tap fires the same click event a mouse does, and the detail card
already carries "branch out" / "add to mix" buttons that don't need a
keyboard or a shift key. So this was a layout and copy problem, not a logic
one, and nothing about the coral, the facets, or the interaction model was
touched.

**What changed:**
- `Scene.tsx`: `OrbitControls` gets an explicit `touches` prop (one finger
  rotate, two finger dolly-pan) instead of relying on the library default.
- `Hud.tsx`: the four corner panels (brief, legend, detail card, mix tray,
  control bar) are now wrapped in two new divs, `.hud__top` and `.hud__dock`.
  They do nothing on desktop. Below 680px they become the positioned
  elements and their children go static and stack in a column, which is
  what stops four absolutely-positioned corners from overlapping on a phone
  screen.
- `Guide.tsx`: added `usePointerCoarse()` off `matchMedia('(pointer:
  coarse)')`, and both the guide overlay and the always-on control bar now
  read from it to swap "shift-click" / "hover" / "right-click" for "hold" /
  "tap" / touch-only copy. Mouse-only verbs on a screen with no mouse were
  the main thing actually broken.
- `index.html`: viewport meta gained `maximum-scale=1, user-scalable=no,
  viewport-fit=cover` so native pinch-zoom does not fight OrbitControls' own
  pinch-to-dolly, and the two docks pad themselves with
  `env(safe-area-inset-*)` so they clear a notch or home indicator.
- `global.css`: the actual mobile media query, `max-width: 680px`, is where
  all of the above gets its stacking, safe-area padding, and touch-target
  sizing (`@media (pointer: coarse) { button { min-height: 44px } }` already
  existed and needed no change).

**Verified.** `npm install` (node_modules was not present in this session's
container), `npx tsc -b` clean, `npm run dev` on port 5180, then screenshotted
with the pre-installed headless Chromium at a 390x844 viewport with
`hasTouch`/`isMobile` set so `(pointer: coarse)` actually matched. Confirmed:
no panel overlap, safe-area padding holds, guide and control bar render the
touch copy. Datamuse (`api.datamuse.com`) is blocked by this container's
egress policy, so growth fell back to the local `brainData` prior during the
screenshot pass; that is a sandbox network restriction, not something this
session's changes touch or broke.

Not done: no separate "mobile app" build or PWA manifest, since the ask was
the existing web app working well on a phone, which is what a viewport meta
change and a responsive layout get to. If Ishan wants it installable to a
home screen as its own icon, that is a manifest.json and a service worker,
raised here rather than assumed.

---

## 2026-09-18 (fourth session, brief)

**Ishan is switching to Claude Code on his phone for a while**, no laptop
session in between builds. Asked for everything, including reasoning, lessons
and open decisions, to always live in GitHub rather than depend on a local
memory file or a session that might not exist next time.

Changed the update discipline in `CLAUDE.md` from "update the docs before you
finish" to "update and push continuously, as you go." The previous rule was
written after a session had already stopped mid-task once with nothing
committed and no note explaining why; on a phone that is more likely, not less,
so waiting for a tidy end-of-session writeup is the wrong shape now. The new
rule asks for small commits with their own journal lines through a session,
rather than one summary commit at the end that a cutoff might never reach.

No code changed this session, only the three doc files.

---

## 2026-09-18 (third session, continued)

**Picked up a session that had stopped midway.** Three files were sitting
uncommitted and unverified: `lib/atlas.ts`, `lib/reefLibrary.ts` and
`components/ReefField.tsx`, plus edits to `Reef.tsx`, `Fish.tsx`, `sprites.ts`
and `fish.ts`. The code typechecked, so the previous session had got it written
but never actually run it.

**Verified it.** It works. Roughly 1200 pieces of reef in a single draw call,
clean console, core loop intact. Tested with the golf trophy brief, which
branched into mysore / trophy / club / golf.

**What the rewrite does.** The reef had grown past what a mesh per sprite could
carry: every piece was its own material and its own per-frame billboard, so the
draw call count rode up with the density and the frame rate followed it down.
Now every sprite is shelf-packed into one atlas, the cast is generated once at
module scope (the reef and the fish share the sheet), and one instanced quad
draws all of it with facing, sway and fog moved into the vertex shader.

**Bug it exposed, and fixed.** A hard-edged dark slab sat under the seed. It was
the pedestal, an 11-unit cylinder painted `#123A55`, and the seabed mounds had
the same problem. Deep blue is a colour the palette can only say as *water*, so
the pixel pass was quantising every face onto a water swatch: the rock the reef
is anchored to was rendering as a hole cut out of the reef. This is the same
lesson the sprites had already learned, just never applied to the real geometry.
Both now come from the stone ramp. The pedestal is also stacked out of
flattened, turned chunks instead of one tapered cylinder, which breaks the
machined silhouette and presents faces the overhead key light can actually
catch. Lesson recorded in the README.

**Raised, not decided.** The reef is now loud enough to compete with the concept
tree, and a distance-band sprite occasionally swings past as a big grey wall.
Left alone deliberately; it is an art-direction call, not a bug. Options listed
under "Known open questions".

Commit `9c1d3cf`, pushed to `origin master`.

**Next session:** decide the reef-vs-tree balance question, then Harvest.

---

## 2026-09-18 (second session)

Grew the reef out: colourful coral species, stones and pixel fish. Replaced the
first draft's three flat silhouettes with 18 full-colour generators painted from
three-tone ramps, taken from how real reef sprite packs break a reef up.
Added the two-frame fish strips, the lit mounds, the concentric parallax bands,
and the caustic seafloor.

Also this session: made the controls explicit and permanent after shift-click
turned out to be undiscoverable, and put the project under git.

Lessons banked in the README: the compounding split chance on the sea fan, stone
never painted in water blue, `aspect` travelling with the sprite, the alpha
channel doubling as the outline mask, clumping rather than scattering, and the
`BackSide` requirement on the backdrop sphere.

Commits `59f9cb8` (initial) and `0919fa1`. Remote MindDelver created and pushed.

---

## 2026-09-16 (first sessions)

Project started. Established the loop (Seed, Sprawl, Fuse, Harvest), the six
facets, and the decision that the brain is live word data from Datamuse rather
than hand-authored lists, with the LLM strictly optional because there is no
Anthropic API key available.

Spatial form decided: living growth / coral, picked over a free-floating
constellation and over flat depth planes.

Label readability solved in three parts (ring fanning, four-word head phrases,
screen-space de-confliction) and the "a label is earned" rule established.

The original visual direction was warm amber and paper. It was replaced on
2026-09-18 by the underwater pixel-art direction and should not come back.

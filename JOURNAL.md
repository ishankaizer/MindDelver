# Journal

One entry per working session, newest first. The durable knowledge belongs in
`README.md`; this file is the record of how it got there and what was decided.

A good entry says what changed, **why**, what was tried and rejected, and what
the next session should pick up. If a session taught a lesson that must not be
relearned, put the lesson in the README's "Hard-won lessons" and note here that
you did.

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

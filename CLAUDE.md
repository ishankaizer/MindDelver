# Working on Bhulandar

## Read these first, before touching anything

1. **`README.md`** is the accumulated knowledge of the project: what it is, why
   it exists, the architecture, and a "Hard-won lessons" section of things that
   each cost real time to learn once. Read that section in particular. It exists
   so mistakes are made once, not once per session.
2. **`JOURNAL.md`** is the session-by-session record, newest first. Read the top
   two or three entries to know where the last session stopped and what it was
   about to do next.

If something in this repo looks wrong or arbitrary, check the lessons section
before "fixing" it. Several of the odd-looking choices are load-bearing and are
documented as such.

## Update these before you finish

**This is not optional, and it is the point of the whole setup: every session
builds on every previous session.**

At the end of a session in which anything was learned, decided, or changed:

- **`JOURNAL.md`** gets a new entry at the top, dated. Say what changed and
  **why**, what was tried and rejected, what was raised but deliberately left
  undecided, and what the next session should pick up. Include commit hashes.
- **`README.md`** gets updated wherever the change made it stale: the
  architecture map if files were added or moved, "Not built yet" if something
  got built, "Known open questions" if something was raised or resolved.
- **The "Hard-won lessons" section** gets a new entry whenever something cost
  real debugging time, or whenever you catch yourself thinking "I should write
  this down so nobody does it again". Write the lesson *and* the symptom it
  produced, because the symptom is how the next session will recognise it.

Do this even for a small session. A one-line journal entry beats a gap.

## House rules

- **No em dashes.** Anywhere. Use a hyphen with spaces, or restructure. This
  applies to code comments, docs, commit messages and anything said to Ishan.
- **Commit before any risky redesign**, so there is something to come back to.
- **Push to `origin master`** (`https://github.com/ishankaizer/MindDelver.git`)
  to deploy. Pushing is the normal end of a piece of work here.
- **Do not redesign the decided things without asking**: the coral growth form,
  the six facets, the underwater pixel-art direction, the explicit controls, or
  the label rules. All four are documented in the README with the reasoning.
- **Verify in the browser before claiming something works.** `npm run dev`, port
  5180. A clean typecheck is not evidence that a 3D scene renders; the last
  session's work typechecked fine and still had a dark slab sitting in the
  middle of it.
- **Build a rough thin slice of everything early** rather than polishing one
  part first, so Ishan can see the whole picture and redirect.

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

## Update these continuously, not just at the end

**This is not optional, and it is the point of the whole setup: every session
builds on every previous session, and GitHub is the only copy that is
guaranteed to still be there next time.**

Ishan is running this from his phone for a while, with no laptop session
sitting open in between. A session can end without warning, mid-task, with no
chance to write a closing summary - this has already happened once. So the rule
is not "document before you finish", it is **document as you go, and commit and
push at every stopping point that would still make sense if nothing came after
it.** Do not save the journal entry, the README updates and the push for a tidy
wrap-up at the end. If you are not sure whether a session is about to be
interrupted, treat it as though it is.

Concretely: after any piece of work that would be a shame to lose the reasoning
for - a decision made, a bug chased down, a direction tried and abandoned -
stop and write it down and commit it before moving to the next piece. A session
that does five things and writes five small commits, each with its own journal
line, is worth more here than one that does five things and writes it all up in
a single commit at the end that a cutoff might never reach.

Four kinds of thing need a home, every time, not just at a session's natural end:

- **What changed and why.** `JOURNAL.md`, new entry at the top, dated. Include
  commit hashes. This is reasoning and thought process, not a changelog - say
  what the alternative was and why it lost, not just what shipped.
- **Errors and lessons that cost real time.** `README.md`'s "Hard-won lessons"
  section. Write the lesson *and* the symptom it produced, because the symptom
  is how the next session will recognise it before it burns the time again.
- **Decisions made.** Wherever they change what the README says is true:
  architecture map, "Not built yet", the decided-things list in House rules.
- **Decisions raised but not made.** `README.md`'s "Known open questions".
  A half-finished thought is still worth a paragraph there. It is much easier
  for the next session, possibly on a different day from a different phone, to
  pick up a written question than to reconstruct that it was ever asked.

A one-line journal entry plus a push beats a gap. A gap is what this exists to
prevent.

## House rules

- **No em dashes.** Anywhere. Use a hyphen with spaces, or restructure. This
  applies to code comments, docs, commit messages and anything said to Ishan.
- **Commit before any risky redesign**, so there is something to come back to.
- **Push to `origin master`** (`https://github.com/ishankaizer/MindDelver.git`)
  frequently, not just once at the end of a session. GitHub is the only copy
  guaranteed to survive between sessions right now. An uncommitted or unpushed
  change does not exist as far as the next session is concerned.
- **Do not redesign the decided things without asking**: the coral growth form,
  the six facets, the underwater pixel-art direction, the explicit controls, or
  the label rules. All four are documented in the README with the reasoning.
- **Verify in the browser before claiming something works.** `npm run dev`, port
  5180. A clean typecheck is not evidence that a 3D scene renders; the last
  session's work typechecked fine and still had a dark slab sitting in the
  middle of it.
- **Build a rough thin slice of everything early** rather than polishing one
  part first, so Ishan can see the whole picture and redirect.

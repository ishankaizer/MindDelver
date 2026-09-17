import { AnimatePresence, motion } from 'framer-motion'
import { PIXEL_GRADES, useGraph } from '../store/useGraph'

function Key({ children }: { children: React.ReactNode }) {
  return <kbd className="key">{children}</kbd>
}

type Row = { keys: React.ReactNode[]; text: string }

const SECTIONS: { title: string; note?: string; rows: Row[] }[] = [
  {
    title: 'moving',
    rows: [
      { keys: ['drag'], text: 'swim around the reef' },
      { keys: ['scroll'], text: 'closer, or further out' },
      { keys: ['right-drag'], text: 'slide the view sideways' },
      { keys: ['esc'], text: 'let go of whatever is selected' },
    ],
  },
  {
    title: 'growing',
    note: 'every node splits six ways at once, one per facet. that is the whole point: you cannot go narrow by accident.',
    rows: [
      { keys: ['hover'], text: 'read a node that has no label yet' },
      { keys: ['click'], text: 'select it, and branch it out' },
      { keys: ['enter'], text: 'branch out whatever is selected' },
    ],
  },
  {
    title: 'combining',
    note: 'the mix is where two or three branches get crossed into one concept. pick things that do not obviously belong together.',
    rows: [
      { keys: ['shift', 'click'], text: 'drop a node into the mix' },
      { keys: ['right-click'], text: 'same thing, without the shift' },
      { keys: ['m'], text: 'drop the selected node in' },
      { keys: ['c'], text: 'combine what is in the mix' },
      { keys: ['x'], text: 'empty the mix' },
    ],
  },
  {
    title: 'the look',
    rows: [
      { keys: ['p'], text: 'pixel grade: pixel, soft, clean' },
      { keys: ['n'], text: 'start a new brief' },
      { keys: ['?'], text: 'open and close this' },
    ],
  },
]

export function Guide() {
  const open = useGraph((s) => s.guideOpen)
  const setOpen = useGraph((s) => s.setGuideOpen)

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="guide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="guide__panel"
            role="dialog"
            aria-label="controls"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="guide__head">
              <h2>how to dive</h2>
              <button onClick={() => setOpen(false)} aria-label="close controls">
                close
              </button>
            </header>

            <p className="guide__lede">
              plant a brief, let it branch, then pull unrelated branches together. the
              breadth is the tool. the mix is the payoff.
            </p>

            <div className="guide__grid">
              {SECTIONS.map((s) => (
                <section key={s.title} className="guide__section">
                  <h3>{s.title}</h3>
                  {s.note ? <p className="guide__note">{s.note}</p> : null}
                  <ul>
                    {s.rows.map((r) => (
                      <li key={r.text}>
                        <span className="guide__keys">
                          {r.keys.map((k, i) => (
                            <Key key={i}>{k}</Key>
                          ))}
                        </span>
                        <span>{r.text}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/**
 * The always-on strip. It carries only the three moves that make the loop work;
 * everything else lives behind the guide. A tool nobody can find the verbs of
 * is a demo, not a tool.
 */
export function ControlBar() {
  const setOpen = useGraph((s) => s.setGuideOpen)
  const grade = useGraph((s) => s.pixelGrade)
  const setGrade = useGraph((s) => s.setPixelGrade)

  return (
    <div className="controlbar">
      <span className="controlbar__item">
        <Key>click</Key> branch out
      </span>
      <span className="controlbar__sep" />
      <span className="controlbar__item">
        <Key>shift</Key>
        <Key>click</Key> add to the mix
      </span>
      <span className="controlbar__sep" />
      <span className="controlbar__item">
        <Key>drag</Key> swim
      </span>
      <span className="controlbar__sep" />
      <button
        className="controlbar__grade"
        onClick={() => setGrade((grade + 1) % PIXEL_GRADES.length)}
        title="pixel grade"
      >
        {PIXEL_GRADES[grade].name}
      </button>
      <button className="controlbar__more" onClick={() => setOpen(true)}>
        controls <Key>?</Key>
      </button>
    </div>
  )
}

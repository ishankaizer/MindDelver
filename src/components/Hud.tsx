import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { FACETS, FACET_ORDER } from '../lib/facets'
import { getLlmKey, setLlmKey } from '../lib/sources/llm'
import { PIXEL_GRADES, useGraph } from '../store/useGraph'
import { ControlBar, Guide, usePointerCoarse } from './Guide'

const EXAMPLES = [
  'a golf trophy for a golf club in Mysore',
  'a desk lamp for a jazz musician',
  'packaging for single-origin coffee',
]

const SEEN_GUIDE = 'bhulandar.seenGuide'

/**
 * Optional, and optional things should not hold a permanent seat in the corner.
 * It sits as one quiet line until asked for, with a lit dot when a key is set.
 */
function KeySlot() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(getLlmKey())
  const [saved, setSaved] = useState(false)
  const hasKey = value.trim().length > 8

  return (
    <div className="keyslot">
      <button
        className="keyslot__toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={'keyslot__dot' + (hasKey ? ' is-on' : '')} />
        {hasKey ? 'model key set' : 'add a model key'}
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            className="keyslot__body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="keyslot__row">
              <input
                id="llmkey"
                type="password"
                value={value}
                aria-label="Gemini or Anthropic API key"
                placeholder="paste a Gemini or Anthropic key"
                onChange={(e) => {
                  setValue(e.target.value)
                  setSaved(false)
                }}
              />
              <button
                onClick={() => {
                  setLlmKey(value)
                  setSaved(true)
                }}
              >
                {saved ? 'saved' : 'save'}
              </button>
            </div>
            <p>
              without one, combining still works off real word data. with one, it writes
              the concept instead of listing the crossing.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function SeedPrompt() {
  const plant = useGraph((s) => s.plant)
  const [value, setValue] = useState(EXAMPLES[0])
  const reduced = useReducedMotion()

  /**
   * The arrival is the one moment this tool gets to make an impression, so the
   * pieces come in on their own beat rather than as one block. Everything is
   * legible from the first frame; the motion only decides the order you read it.
   */
  const container = {
    hidden: {},
    shown: {
      transition: { staggerChildren: reduced ? 0 : 0.085, delayChildren: reduced ? 0 : 0.1 },
    },
  }

  const rise = {
    hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 16, filter: 'blur(10px)' },
    shown: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: reduced ? 0.2 : 0.85, ease: [0.16, 1, 0.3, 1] as const },
    },
  }

  const mark = {
    hidden: reduced
      ? { opacity: 0 }
      : { opacity: 0, y: 22, filter: 'blur(16px)', letterSpacing: '0.16em' },
    shown: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      letterSpacing: '0.02em',
      transition: { duration: reduced ? 0.2 : 1.15, ease: [0.16, 1, 0.3, 1] as const },
    },
  }

  return (
    <motion.div
      className="seed-prompt"
      variants={container}
      initial="hidden"
      animate="shown"
      exit={{ opacity: 0, y: -12, filter: 'blur(8px)', transition: { duration: 0.45 } }}
    >
      <motion.h1 variants={mark}>bhulandar</motion.h1>
      <motion.p className="seed-prompt__sub" variants={rise}>
        plant a brief. watch it branch. pull the branches together.
      </motion.p>
      <motion.form
        variants={rise}
        onSubmit={(e) => {
          e.preventDefault()
          if (value.trim()) plant(value.trim())
        }}
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="what are you making?"
          aria-label="your brief"
        />
        <button type="submit">plant</button>
      </motion.form>
      <motion.div className="seed-prompt__examples" variants={rise}>
        {EXAMPLES.map((e) => (
          <button key={e} onClick={() => setValue(e)}>
            {e}
          </button>
        ))}
      </motion.div>
    </motion.div>
  )
}

function Legend() {
  return (
    <div className="legend">
      {FACET_ORDER.map((f) => (
        <div key={f} className="legend__row">
          <span className="legend__dot" style={{ background: FACETS[f].color }} />
          <span className="legend__label">{FACETS[f].label}</span>
          <span className="legend__blurb">{FACETS[f].blurb}</span>
        </div>
      ))}
    </div>
  )
}

function Detail() {
  const node = useGraph((s) => (s.selectedId ? s.nodes[s.selectedId] : null))
  const grow = useGraph((s) => s.grow)
  const toggleMix = useGraph((s) => s.toggleMix)
  const inMix = useGraph((s) => (s.selectedId ? s.mixIds.includes(s.selectedId) : false))

  if (!node) return null
  const facet = FACETS[node.facet]

  return (
    <motion.div
      key={node.id}
      className="detail"
      initial={{ opacity: 0, y: 12, filter: 'blur(5px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 8, filter: 'blur(5px)' }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="detail__facet" style={{ color: facet.color }}>
        <span className="legend__dot" style={{ background: facet.color }} />
        {facet.label}
        {node.tag ? <em>{node.tag}</em> : null}
      </span>
      <h2>{node.label}</h2>
      {node.note ? <p>{node.note}</p> : null}
      {node.empty ? <p className="detail__empty">nothing found for this one.</p> : null}
      <div className="detail__actions">
        <button onClick={() => void grow(node.id)} disabled={node.grown || node.pending}>
          {node.pending ? 'thinking' : node.grown ? 'grown' : 'branch out'}
          <kbd className="key">enter</kbd>
        </button>
        <button className={inMix ? 'is-on' : ''} onClick={() => toggleMix(node.id)}>
          {inMix ? 'in the mix' : 'add to mix'}
          <kbd className="key">m</kbd>
        </button>
      </div>
    </motion.div>
  )
}

/**
 * Always on screen once a brief is planted, empty slots and all. Crossing two
 * branches is the point of the whole tool and it used to be reachable only by
 * a shift-click nobody was told about; a tray with two visible holes in it
 * asks to be filled.
 */
function MixTray() {
  const mixIds = useGraph((s) => s.mixIds)
  const nodes = useGraph((s) => s.nodes)
  const toggleMix = useGraph((s) => s.toggleMix)
  const clearMix = useGraph((s) => s.clearMix)
  const makeFusion = useGraph((s) => s.makeFusion)
  const fusing = useGraph((s) => s.fusing)
  const coarse = usePointerCoarse()

  const empties = Math.max(0, 2 - mixIds.length)

  return (
    <motion.div
      className={'mix' + (mixIds.length >= 2 ? ' is-ready' : '')}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
    >
      <div className="mix__head">
        <span className="mix__title">the mix</span>
        <span className="mix__hint">
          {mixIds.length === 0
            ? coarse
              ? 'select a node, then add to mix'
              : 'shift-click two branches'
            : mixIds.length === 1
              ? 'one more to cross it with'
              : 'cross them'}
        </span>
      </div>

      <div className="mix__chips">
        {mixIds.map((id) => {
          const n = nodes[id]
          if (!n) return null
          return (
            <button
              key={id}
              className="mix__chip"
              style={{ '--facet': FACETS[n.facet].color } as React.CSSProperties}
              onClick={() => toggleMix(id)}
            >
              {n.label}
              <span>&times;</span>
            </button>
          )
        })}
        {Array.from({ length: empties }, (_, i) => (
          <span key={i} className="mix__slot" />
        ))}
      </div>

      <div className="mix__actions">
        <button
          className="mix__go"
          disabled={mixIds.length < 2 || fusing}
          onClick={() => void makeFusion()}
        >
          {fusing ? 'crossing' : 'combine'}
          <kbd className="key">c</kbd>
        </button>
        <button className="mix__clear" onClick={clearMix} disabled={mixIds.length === 0}>
          clear
        </button>
      </div>
    </motion.div>
  )
}

/**
 * One listener reading the store fresh on every press, rather than a handler
 * per action re-bound whenever the graph changes.
 */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const s = useGraph.getState()

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        s.setGuideOpen(!s.guideOpen)
        return
      }
      if (e.key === 'Escape') {
        if (s.guideOpen) s.setGuideOpen(false)
        else s.select(null)
        return
      }
      if (!s.brief) return

      switch (e.key.toLowerCase()) {
        case 'enter':
          if (s.selectedId) void s.grow(s.selectedId)
          break
        case 'm':
          if (s.selectedId) s.toggleMix(s.selectedId)
          break
        case 'c':
          if (s.mixIds.length >= 2) void s.makeFusion()
          break
        case 'x':
          s.clearMix()
          break
        case 'p':
          s.setPixelGrade((s.pixelGrade + 1) % PIXEL_GRADES.length)
          break
        case 'n':
          s.plant('')
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function Hud() {
  const brief = useGraph((s) => s.brief)
  const plant = useGraph((s) => s.plant)
  const setGuideOpen = useGraph((s) => s.setGuideOpen)
  useShortcuts()

  // the first dive gets the map opened for it, once, ever
  useEffect(() => {
    if (!brief || localStorage.getItem(SEEN_GUIDE)) return
    localStorage.setItem(SEEN_GUIDE, '1')
    const id = window.setTimeout(() => setGuideOpen(true), 900)
    return () => window.clearTimeout(id)
  }, [brief, setGuideOpen])

  return (
    <div className="hud">
      <AnimatePresence mode="wait">{!brief ? <SeedPrompt key="seed" /> : null}</AnimatePresence>

      {brief ? (
        <>
          <div className="hud__top">
            <motion.div
              className="brief"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="brief__mark">bhulandar</span>
              <span className="brief__text">{brief}</span>
              <button onClick={() => plant('')}>new brief</button>
            </motion.div>

            <motion.div
              className="legend-wrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Legend />
              <KeySlot />
            </motion.div>
          </div>

          <div className="hud__dock">
            <AnimatePresence mode="wait">
              <Detail />
            </AnimatePresence>
            <MixTray />
            <ControlBar />
          </div>
        </>
      ) : null}

      <Guide />
    </div>
  )
}

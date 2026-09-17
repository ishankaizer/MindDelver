export type Sense = {
  pos: string
  registers: string[]
  gloss: string
  label: string
  /** the single word this sense is best expanded from */
  query: string
  figurative: boolean
}

const FIGURATIVE = new Set([
  'slang', 'figurative', 'idiomatic', 'colloquial', 'informal', 'humorous',
  'metaphor', 'euphemistic', 'poetic', 'obsolete', 'archaic', 'dated',
])

const LEAD_ARTICLE = /^(a|an|the)\s+/i
const TRAILING_JUNK = /[\s.;,]+$/

const CONNECTORS = new Set([
  'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'and', 'or', 'as',
  'that', 'which', 'who', 'the', 'a', 'an', 'is', 'are', 'especially', 'usually',
  'particularly', 'typically', 'often', 'chiefly', 'now',
])

const CONTENT_STOP = new Set([
  ...CONNECTORS,
  'someone', 'something', 'anything', 'one', 'person', 'people', 'thing',
  'used', 'having', 'being', 'relating', 'pertaining', 'act', 'state',
  'any', 'all', 'some', 'such', 'other', 'another', 'more', 'most', 'very',
])

function words(s: string): string[] {
  return s.split(/\s+/).filter(Boolean)
}

/** A label has to survive being read at a glance on a floating pill. */
const MAX_LABEL_WORDS = 4

/**
 * Cut a gloss down to its head phrase. The full wording is never lost: it stays
 * on the node as `gloss` and shows in the detail panel when the node is picked.
 */
function headPhrase(s: string): string {
  const all = words(s)
  const out: string[] = []
  for (let i = 0; i < all.length && out.length < MAX_LABEL_WORDS; i++) {
    const w = all[i].toLowerCase()
    // a connector after the head means the rest is a qualifying clause, so stop.
    // index 0 is exempt so an infinitive keeps its "to".
    if (i >= 2 && CONNECTORS.has(w.replace(/[^a-z]/g, ''))) break
    out.push(all[i])
  }
  const cut = out.length < all.length
  return out.join(' ').toLowerCase() + (cut ? '…' : '')
}

/** Reduce a dictionary gloss to something that reads as a node on a branch. */
function glossToLabel(gloss: string): string {
  const base = gloss
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(TRAILING_JUNK, '')
    .replace(LEAD_ARTICLE, '')
    .trim()

  const chunks = base
    .replace(/\s+or\s+/gi, ', ')
    .split(/[,;:]/)
    .map((c) => c.replace(LEAD_ARTICLE, '').trim())
    .filter(Boolean)

  // the shortest self-contained chunk reads best; a one word chunk is usually a
  // stray fragment, so two words is the floor when anything else is available
  const ranked = chunks
    .map((c) => ({ text: c, n: words(c).length }))
    .filter((x) => x.n <= MAX_LABEL_WORDS)
    .sort((a, b) => a.n - b.n)

  const best = ranked.find((x) => x.n >= 2) ?? ranked[0]
  if (best) return best.text.toLowerCase()

  return headPhrase(base)
}

/** The one word worth running further queries against. */
function glossToQuery(label: string, fallback: string): string {
  const tokens = words(label.replace(/[^a-zA-Z\s-]/g, ' '))
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 2 && !CONTENT_STOP.has(t))

  if (tokens.length === 0) return fallback
  return tokens[tokens.length - 1]
}

export function parseSenses(defs: string[] | undefined, fallback: string): Sense[] {
  if (!defs || defs.length === 0) return []

  const out: Sense[] = []
  const seenLabels = new Set<string>()

  for (const raw of defs) {
    const tab = raw.indexOf('\t')
    const pos = tab > 0 ? raw.slice(0, tab).trim() : ''
    const rest = (tab > 0 ? raw.slice(tab + 1) : raw).trim()

    const parenMatch = rest.match(/^\(([^)]*)\)\s*/)
    const registers = parenMatch
      ? parenMatch[1]
          .split(/,\s*/)
          .map((r) => r.trim().toLowerCase())
          .filter(Boolean)
      : []

    const gloss = rest.replace(/^\([^)]*\)\s*/, '').replace(TRAILING_JUNK, '').trim()
    if (!gloss) continue

    const label = glossToLabel(gloss)
    if (!label || label.length < 3) continue

    const dedupeKey = label.replace(/[^a-z]/g, '')
    if (seenLabels.has(dedupeKey)) continue
    seenLabels.add(dedupeKey)

    out.push({
      pos,
      registers,
      gloss,
      label,
      query: glossToQuery(label, fallback),
      figurative: registers.some((r) =>
        [...FIGURATIVE].some((f) => r.includes(f)),
      ),
    })
  }

  return out
}

/**
 * Pick senses that are actually different from each other, biased toward the
 * brief but never collapsing onto it. Breadth is the whole point of the tool,
 * so distant senses are kept on purpose.
 */
export function chooseSenses(senses: Sense[], context: string[], limit: number): Sense[] {
  if (senses.length === 0) return []

  const ctx = new Set(
    context.flatMap((c) => c.toLowerCase().split(/\s+/)).filter((w) => w.length > 2),
  )

  const scored = senses.map((s, i) => {
    const glossWords = s.gloss.toLowerCase().split(/\W+/)
    const overlap = glossWords.filter((w) => ctx.has(w)).length
    return { sense: s, overlap, order: i }
  })

  const picked: Sense[] = []
  const usedPos = new Set<string>()

  const byContext = [...scored].sort(
    (a, b) => b.overlap - a.overlap || a.order - b.order,
  )
  const contextual = byContext.find((s) => s.overlap > 0)
  if (contextual) {
    picked.push(contextual.sense)
    usedPos.add(contextual.sense.pos)
  }

  // the plain first sense, which is usually the core meaning
  for (const s of scored) {
    if (picked.length >= limit) break
    if (picked.includes(s.sense)) continue
    if (!s.sense.figurative) {
      picked.push(s.sense)
      usedPos.add(s.sense.pos)
      break
    }
  }

  // a figurative or slang reading, which is where the good jumps live
  for (const s of scored) {
    if (picked.length >= limit) break
    if (picked.includes(s.sense)) continue
    if (s.sense.figurative) {
      picked.push(s.sense)
      break
    }
  }

  // a different part of speech, so a noun brief still surfaces the verb
  for (const s of scored) {
    if (picked.length >= limit) break
    if (picked.includes(s.sense)) continue
    if (!usedPos.has(s.sense.pos)) {
      picked.push(s.sense)
      usedPos.add(s.sense.pos)
    }
  }

  // spread the remainder across the list rather than taking the next few in order
  const remaining = scored.filter((s) => !picked.includes(s.sense))
  const stride = Math.max(1, Math.floor(remaining.length / Math.max(1, limit - picked.length)))
  for (let i = 0; i < remaining.length && picked.length < limit; i += stride) {
    picked.push(remaining[i].sense)
  }

  return picked.slice(0, limit)
}

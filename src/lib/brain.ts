import { BRAIN, FUSIONS } from './brainData'
import type { FacetId } from './facets'
import { chooseSenses, parseSenses } from './senses'
import { clean, query, type DatamuseWord } from './sources/datamuse'
import { llmConcept, llmIsConfigured } from './sources/llm'

export type BrainSprout = {
  label: string
  facet: FacetId
  note?: string
  tag?: string
  /** the term further queries should run against, when it differs from the label */
  query?: string
}

export type Context = {
  brief: string
  ancestors: string[]
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'for', 'of', 'in', 'on', 'at', 'to', 'and', 'or', 'with',
  'from', 'by', 'is', 'are', 'was', 'be', 'that', 'this', 'it', 'its', 'as',
  'make', 'making', 'design', 'designing', 'create', 'based', 'about', 'some',
  'i', 'me', 'my', 'we', 'need', 'want', 'new', 'project', 'thing',
])

const key = (label: string) => label.toLowerCase().trim()

/** Datamuse accepts at most five topic words to bias a query with. */
function topicsFor(ctx: Context): string {
  const briefWords = ctx.brief
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))

  const ordered = [...ctx.ancestors.map(key), ...briefWords]
  const seen = new Set<string>()
  const out: string[] = []
  for (const w of ordered) {
    const head = w.split(/\s+/).pop() ?? w
    if (!head || seen.has(head)) continue
    seen.add(head)
    out.push(head)
    if (out.length >= 5) break
  }
  return out.join(',')
}

function take(
  words: DatamuseWord[],
  facet: FacetId,
  limit: number,
  against: string[],
  used: Set<string>,
): BrainSprout[] {
  const picked = clean(words, { against: [...against, ...used], limit })
  const out: BrainSprout[] = []
  for (const w of picked) {
    if (used.has(w)) continue
    used.add(w)
    out.push({ label: w, facet })
  }
  return out
}

export async function sprout(label: string, ctx: Context): Promise<BrainSprout[]> {
  const term = key(label)
  const topics = topicsFor(ctx)
  const used = new Set<string>([term])
  const against = [term, ...ctx.ancestors.map(key)]
  const out: BrainSprout[] = []

  const curated = BRAIN[term]
  if (curated) {
    for (const c of curated.slice(0, 5)) {
      used.add(key(c.label))
      out.push({ label: c.label, facet: c.facet, note: c.note })
    }
  }

  const [defs, gen, spc, jjb, jja, com, par, trgCtx, trgRaw, syn] = await Promise.all([
    query({ sp: term, md: 'dp', max: 1 }),
    query({ rel_gen: term, max: 12 }),
    query({ rel_spc: term, max: 12, topics }),
    query({ rel_jjb: term, max: 14, topics }),
    query({ rel_jja: term, max: 14, topics }),
    query({ rel_com: term, max: 10 }),
    query({ rel_par: term, max: 10 }),
    query({ rel_trg: term, max: 20, topics }),
    query({ rel_trg: term, max: 20 }),
    query({ rel_syn: term, max: 10 }),
  ])

  const senses = parseSenses(defs[0]?.defs, term)
  const adjectival =
    senses.length > 0 ? senses[0].pos === 'adj' : jja.length > jjb.length

  for (const s of chooseSenses(senses, [ctx.brief, ...ctx.ancestors], 3)) {
    const k = key(s.label)
    if (used.has(k)) continue
    used.add(k)
    out.push({
      label: s.label,
      facet: 'sense',
      note: s.gloss,
      tag: s.registers[0],
      query: s.query,
    })
  }

  if (adjectival) {
    // for an adjective the useful concrete move is "what gets called this"
    out.push(...take(jja, 'kind', 3, against, used))
    out.push(...take([...syn, ...jjb], 'quality', 2, against, used))
  } else {
    out.push(...take([...spc, ...gen], 'kind', 3, against, used))
    out.push(...take(jjb, 'quality', 2, against, used))
  }

  out.push(...take([...com, ...par], 'part', 2, against, used))
  out.push(...take(trgCtx, 'context', 3, against, used))

  // sideways is deliberately the unbiased query, so the brief cannot narrow it
  out.push(...take(trgRaw, 'sideways', 2, against, used))

  return out
}

export type FusionResult = {
  title: string
  body: string
  crossings: string[]
  provisional?: boolean
}

async function relatedSet(term: string): Promise<DatamuseWord[]> {
  const [trg, ml, jjb, jja] = await Promise.all([
    query({ rel_trg: term, max: 80 }),
    query({ ml: term, max: 60 }),
    query({ rel_jjb: term, max: 40 }),
    query({ rel_jja: term, max: 40 }),
  ])
  return [...trg, ...ml, ...jjb, ...jja]
}

export async function fuse(labels: string[], ctx: Context): Promise<FusionResult> {
  const terms = labels.map(key)
  const exact = FUSIONS[[...terms].sort().join('+')]
  if (exact) return { ...exact, crossings: [] }

  const sets = await Promise.all(
    terms.map(async (t) => {
      const head = t.split(/\s+/).pop() ?? t
      const words = await relatedSet(head)
      return new Map(
        clean(words, { against: terms, limit: 200 }).map((w, i) => [w, 200 - i]),
      )
    }),
  )

  const tally = new Map<string, { hits: number; score: number }>()
  for (const set of sets) {
    for (const [word, score] of set) {
      const cur = tally.get(word) ?? { hits: 0, score: 0 }
      cur.hits += 1
      cur.score += score
      tally.set(word, cur)
    }
  }

  const crossings = [...tally.entries()]
    .filter(([, v]) => v.hits >= 2)
    .sort((a, b) => b[1].hits - a[1].hits || b[1].score - a[1].score)
    .slice(0, 7)
    .map(([w]) => w)

  if (llmIsConfigured()) {
    const written = await llmConcept(labels, crossings, ctx.brief)
    if (written) return { ...written, crossings }
  }

  if (crossings.length === 0) {
    return {
      title: labels.join(' × '),
      body: `Nothing in the language connects ${labels.join(', ')}. That gap is either a dead end or the most original thing on the board.`,
      crossings: [],
      provisional: true,
    }
  }

  const [first, ...rest] = crossings
  return {
    title: first,
    body: `${labels.join(', ')} all pull toward ${first}.${
      rest.length ? ` Also sitting on the crossing: ${rest.slice(0, 5).join(', ')}.` : ''
    }`,
    crossings,
    provisional: !llmIsConfigured(),
  }
}

export function seedTerms(brief: string): string[] {
  const lower = brief.toLowerCase()
  const hits = Object.keys(BRAIN)
    .filter((k) => lower.includes(k))
    .sort((a, b) => b.length - a.length)

  const picked: string[] = []
  for (const h of hits) {
    if (picked.some((p) => p.includes(h))) continue
    picked.push(h)
  }

  const words = lower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))

  const unique: string[] = []
  for (const w of [...picked, ...words]) {
    if (unique.some((u) => u === w || u.includes(w))) continue
    unique.push(w)
  }
  return unique.slice(0, 4)
}

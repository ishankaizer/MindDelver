export type DatamuseWord = {
  word: string
  score?: number
  tags?: string[]
  defs?: string[]
}

const BASE = 'https://api.datamuse.com/words'
const cache = new Map<string, Promise<DatamuseWord[]>>()

export type Query = {
  sp?: string
  ml?: string
  rel_gen?: string
  rel_spc?: string
  rel_com?: string
  rel_par?: string
  rel_jja?: string
  rel_jjb?: string
  rel_trg?: string
  rel_syn?: string
  rel_ant?: string
  topics?: string
  md?: string
  max?: number
}

export function query(q: Query): Promise<DatamuseWord[]> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === '') continue
    params.set(k, String(v))
  }
  const url = `${BASE}?${params.toString()}`

  let hit = cache.get(url)
  if (!hit) {
    hit = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<DatamuseWord[]>) : []))
      .catch(() => [] as DatamuseWord[])
    cache.set(url, hit)
  }
  return hit
}

/**
 * Datamuse leans on a thesaurus that coughs up placeholder nouns for abstract
 * queries. They are never useful as ideation prompts.
 */
const JUNK = new Set([
  'whatsis', 'whatsit', 'whatchamacallit', 'whatchamacallum', 'thingamabob',
  'thingamajig', 'thingmabob', 'thingumabob', 'thingummy', 'thingy', 'doodad',
  'dohickey', 'doohickey', 'gizmo', 'gismo', 'stuff', 'sundry', 'sundries',
  'thing', 'things', 'object', 'entity', 'item', 'items', 'article', 'articles',
  'kind', 'kinds', 'sort', 'sorts', 'type', 'types', 'way', 'ways', 'one', 'ones',
  'part', 'parts', 'end', 'ends', 'unit', 'units', 'group', 'groups', 'set',
  'form', 'forms', 'matter', 'material', 'substance', 'element', 'body',
  'person', 'people', 'someone', 'something', 'anything', 'other', 'others',
  'act', 'action', 'state', 'condition', 'property', 'quality', 'attribute',
  'amount', 'measure', 'degree', 'device', 'instrument', 'implement', 'artifact',
  'artefact', 'whole', 'change', 'event', 'activity', 'process', 'having', 'being',
])

const FUNCTION_WORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'by', 'from',
  'and', 'or', 'but', 'as', 'is', 'are', 'was', 'be', 'been', 'that', 'this',
  'it', 'its', 'not', 'no', 'so', 'if', 'than', 'then', 'very', 'more', 'most',
  'much', 'many', 'such', 'only', 'also', 'just', 'enough', 'own', 'same',
  'first', 'second', 'third', 'another', 'each', 'every', 'any', 'all', 'both',
])

function stem(w: string): string {
  return w
    .toLowerCase()
    .replace(/(ies|ied)$/, 'y')
    .replace(/(sses|shes|ches|xes)$/, '')
    .replace(/(ing|ed|es|s)$/, '')
}

/** True when b is just a morphological restatement of a, e.g. trophy / trophies. */
function isVariant(a: string, b: string): boolean {
  const sa = stem(a)
  const sb = stem(b)
  if (sa === sb) return true
  const short = sa.length < sb.length ? sa : sb
  const long = sa.length < sb.length ? sb : sa
  return short.length >= 4 && long.startsWith(short)
}

export type CleanOptions = {
  against: string[]
  limit: number
  minScore?: number
}

export function clean(words: DatamuseWord[], opts: CleanOptions): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const top = words[0]?.score ?? 0
  const floor = opts.minScore ?? (top > 0 ? top * 0.06 : 0)

  for (const w of words) {
    const raw = w.word.trim().toLowerCase()
    if (!raw || raw.length < 3) continue
    if (!/^[a-z][a-z' -]*[a-z]$/.test(raw)) continue
    if ((w.score ?? 0) < floor) continue

    const tokens = raw.split(/[\s-]+/)
    if (tokens.length > 3) continue
    if (tokens.every((t) => JUNK.has(t) || FUNCTION_WORDS.has(t))) continue
    if (tokens.length === 1 && JUNK.has(tokens[0])) continue

    if (seen.has(raw)) continue
    if (opts.against.some((a) => isVariant(a, raw))) continue
    if (out.some((o) => isVariant(o, raw))) continue

    seen.add(raw)
    out.push(raw)
    if (out.length >= opts.limit) break
  }
  return out
}

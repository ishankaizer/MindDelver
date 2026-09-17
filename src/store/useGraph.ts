import { create } from 'zustand'
import * as THREE from 'three'
import { fuse, seedTerms, sprout, type BrainSprout, type Context } from '../lib/brain'
import type { FacetId } from '../lib/facets'
import {
  branchLength,
  branchRadius,
  childDirection,
  hash01,
  hashString,
  seedDirection,
} from '../lib/growth'

export type IdeaNode = {
  id: string
  label: string
  facet: FacetId
  note?: string
  tag?: string
  /** what further queries run against, when it differs from the label */
  queryTerm: string
  parentId: string | null
  depth: number
  childIds: string[]
  grown: boolean
  pending: boolean
  empty: boolean
  dir: THREE.Vector3
  length: number
  radius: number
  bend: [number, number]
  born: number
  seed: number
}

export type FusionBlob = {
  id: string
  title: string
  body: string
  crossings: string[]
  provisional?: boolean
  parentIds: string[]
  position: THREE.Vector3
  born: number
}

export const SEED_ID = 'seed'

/**
 * How hard the pixel pass bites. Three stops rather than a slider: the only
 * choices anyone actually wants are "the look", "half the look" and "let me
 * read the geometry for a second".
 */
export const PIXEL_GRADES = [
  { name: 'clean', pixel: 1, palette: 0, dither: 0, saturation: 1.04 },
  { name: 'soft', pixel: 3, palette: 0.6, dither: 0.06, saturation: 1.12 },
  { name: 'pixel', pixel: 5, palette: 1, dither: 0.09, saturation: 1.2 },
] as const

const GRADE_KEY = 'bhulandar.pixelGrade'

const DEFAULT_GRADE = PIXEL_GRADES.length - 1

function storedGrade(): number {
  // Number(null) is 0, not NaN, so an absent key has to be caught before the
  // parse or every first visit silently lands on the least interesting grade
  const raw = localStorage.getItem(GRADE_KEY)
  if (raw === null) return DEFAULT_GRADE
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 && n < PIXEL_GRADES.length ? n : DEFAULT_GRADE
}

type GraphState = {
  brief: string
  nodes: Record<string, IdeaNode>
  fusions: FusionBlob[]
  selectedId: string | null
  mixIds: string[]
  fusing: boolean
  pixelGrade: number
  guideOpen: boolean
  plant: (brief: string) => void
  plantFrom: (word: string) => void
  grow: (id: string) => Promise<void>
  select: (id: string | null) => void
  toggleMix: (id: string) => void
  clearMix: () => void
  makeFusion: () => Promise<void>
  dismissFusion: (id: string) => void
  setPixelGrade: (grade: number) => void
  setGuideOpen: (open: boolean) => void
}

function makeNode(
  id: string,
  label: string,
  facet: FacetId,
  parent: IdeaNode | null,
  index: number,
  count: number,
  extra: Partial<IdeaNode> = {},
): IdeaNode {
  const depth = parent ? parent.depth + 1 : 0
  const seed = hashString(id)
  const dir = parent
    ? parent.id === SEED_ID
      ? seedDirection(index, count)
      : childDirection(parent.dir, index, count, depth, seed)
    : new THREE.Vector3(0, 1, 0)

  return {
    id,
    label,
    facet,
    queryTerm: label,
    parentId: parent ? parent.id : null,
    depth,
    childIds: [],
    grown: false,
    pending: false,
    empty: false,
    dir,
    length: parent ? branchLength(depth) : 0,
    radius: parent ? branchRadius(depth) : 0.3,
    bend: [(hash01(seed * 17) - 0.5) * 0.34, (hash01(seed * 41) - 0.5) * 0.34],
    born: performance.now(),
    seed,
    ...extra,
  }
}

export function worldPosition(
  nodes: Record<string, IdeaNode>,
  id: string,
): THREE.Vector3 {
  const chain: IdeaNode[] = []
  let cur = nodes[id]
  while (cur) {
    chain.unshift(cur)
    cur = cur.parentId ? nodes[cur.parentId] : (undefined as unknown as IdeaNode)
  }
  const pos = new THREE.Vector3()
  for (const n of chain) {
    if (n.parentId) pos.addScaledVector(n.dir, n.length)
  }
  return pos
}

/** Labels from this node up to the root, nearest first. Drives contextual bias. */
function ancestorsOf(nodes: Record<string, IdeaNode>, id: string): string[] {
  const out: string[] = []
  let cur = nodes[id]
  while (cur && cur.parentId) {
    cur = nodes[cur.parentId]
    if (cur && cur.id !== SEED_ID) out.push(cur.queryTerm || cur.label)
  }
  return out
}

let counter = 0
const nextId = () => `n${++counter}`

export const useGraph = create<GraphState>((set, get) => ({
  brief: '',
  nodes: {},
  fusions: [],
  selectedId: null,
  mixIds: [],
  fusing: false,
  pixelGrade: storedGrade(),
  guideOpen: false,

  plant: (brief) => {
    counter = 0
    const seedNode = makeNode(SEED_ID, brief, 'sense', null, 0, 1, { grown: true })
    const nodes: Record<string, IdeaNode> = { [SEED_ID]: seedNode }

    const terms = seedTerms(brief)
    terms.forEach((term, i) => {
      const id = nextId()
      nodes[id] = makeNode(id, term, 'sense', seedNode, i, terms.length)
      seedNode.childIds.push(id)
    })

    set({ brief, nodes, fusions: [], selectedId: null, mixIds: [] })
  },

  plantFrom: (word) => {
    const { nodes } = get()
    const seedNode = nodes[SEED_ID]
    if (!seedNode) return
    if (Object.values(nodes).some((n) => n.label.toLowerCase() === word.toLowerCase())) {
      return
    }

    const next = { ...nodes }
    const parent: IdeaNode = { ...seedNode, childIds: [...seedNode.childIds] }
    const id = nextId()
    const total = parent.childIds.length + 1
    next[id] = makeNode(id, word, 'sense', parent, parent.childIds.length, total)
    parent.childIds.push(id)
    next[SEED_ID] = parent

    set({ nodes: next, selectedId: id })
  },

  grow: async (id) => {
    const { nodes, brief } = get()
    const parent = nodes[id]
    if (!parent || parent.grown || parent.pending) return

    set({ nodes: { ...nodes, [id]: { ...parent, pending: true } } })

    const ctx: Context = { brief, ancestors: ancestorsOf(nodes, id) }
    let sprouts: BrainSprout[]
    try {
      sprouts = await sprout(parent.queryTerm || parent.label, ctx)
    } catch {
      sprouts = []
    }

    const current = get().nodes
    const live = current[id]
    if (!live) return

    const next = { ...current }
    const parentCopy: IdeaNode = {
      ...live,
      grown: true,
      pending: false,
      empty: sprouts.length === 0,
      childIds: [],
    }
    next[id] = parentCopy

    sprouts.forEach((s, i) => {
      const cid = nextId()
      next[cid] = makeNode(cid, s.label, s.facet, parentCopy, i, sprouts.length, {
        note: s.note,
        tag: s.tag,
        queryTerm: s.query ?? s.label,
      })
      parentCopy.childIds.push(cid)
    })

    set({ nodes: next })
  },

  select: (id) => set({ selectedId: id }),

  toggleMix: (id) =>
    set((s) => {
      if (s.mixIds.includes(id)) return { mixIds: s.mixIds.filter((m) => m !== id) }
      if (s.mixIds.length >= 3) return { mixIds: [...s.mixIds.slice(1), id] }
      return { mixIds: [...s.mixIds, id] }
    }),

  clearMix: () => set({ mixIds: [] }),

  makeFusion: async () => {
    const { mixIds, nodes, fusions, brief, fusing } = get()
    if (mixIds.length < 2 || fusing) return

    set({ fusing: true })
    const labels = mixIds.map((m) => nodes[m].queryTerm || nodes[m].label)

    let result
    try {
      result = await fuse(labels, { brief, ancestors: [] })
    } catch {
      result = null
    }
    if (!result) {
      set({ fusing: false })
      return
    }

    const centroid = new THREE.Vector3()
    mixIds.forEach((m) => centroid.add(worldPosition(get().nodes, m)))
    centroid.multiplyScalar(1 / mixIds.length)
    centroid.y += 1.4

    const id = `f${fusions.length + 1}`
    set({
      fusions: [
        ...fusions,
        {
          id,
          title: result.title,
          body: result.body,
          crossings: result.crossings,
          provisional: result.provisional,
          parentIds: mixIds,
          position: centroid,
          born: performance.now(),
        },
      ],
      mixIds: [],
      fusing: false,
    })
  },

  dismissFusion: (id) =>
    set((s) => ({ fusions: s.fusions.filter((f) => f.id !== id) })),

  setPixelGrade: (grade) => {
    localStorage.setItem(GRADE_KEY, String(grade))
    set({ pixelGrade: grade })
  },

  setGuideOpen: (open) => set({ guideOpen: open }),
}))

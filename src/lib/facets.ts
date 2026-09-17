export type FacetId = 'sense' | 'kind' | 'quality' | 'part' | 'context' | 'sideways'

export type Facet = {
  id: FacetId
  label: string
  color: string
  blurb: string
}

export const FACETS: Record<FacetId, Facet> = {
  sense: {
    id: 'sense',
    label: 'means',
    color: '#EADCC8',
    blurb: 'every thing the word can mean',
  },
  kind: {
    id: 'kind',
    label: 'kinds',
    color: '#4FD99A',
    blurb: 'narrower and wider than it',
  },
  quality: {
    id: 'quality',
    label: 'qualities',
    color: '#FF6F9F',
    blurb: 'how it gets described',
  },
  part: {
    id: 'part',
    label: 'parts',
    color: '#FF9247',
    blurb: 'what it is made of, what it belongs to',
  },
  context: {
    id: 'context',
    label: 'nearby',
    color: '#A97BF0',
    blurb: 'what it drags in, read against your brief',
  },
  sideways: {
    id: 'sideways',
    label: 'sideways',
    color: '#DCE85C',
    blurb: 'the same word ignoring your brief',
  },
}

export const FACET_ORDER: FacetId[] = [
  'sense',
  'kind',
  'quality',
  'part',
  'context',
  'sideways',
]

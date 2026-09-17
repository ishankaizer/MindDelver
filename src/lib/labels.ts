/**
 * A 3D fan looks evenly spread until you project it. The half of the ring that
 * points at the camera foreshortens into a pile, so labels that are far apart
 * in space land on top of each other on screen. Spreading the branches wider
 * helps but cannot fix it, because the collision happens in 2D.
 *
 * So labels compete. Every label states what it wants and how much it deserves
 * to be read; one pass per couple of frames walks them in priority order and
 * lets the loser fade rather than overlap the winner.
 */
export type LabelEntry = {
  el: HTMLDivElement | null
  /** higher wins a collision */
  priority: number
  /** opacity the node would like, before any collision is considered */
  wants: number
  /** set by the de-confliction pass */
  allowed: boolean
}

export const labels = new Map<string, LabelEntry>()

/** Labels quieter than this are not worth fighting over. */
const FLOOR = 0.06

/** A little breathing room, so two pills never kiss. */
const PAD = 3

type Box = { left: number; right: number; top: number; bottom: number }

function overlaps(a: Box, b: Box): boolean {
  return !(
    a.right < b.left - PAD ||
    a.left > b.right + PAD ||
    a.bottom < b.top - PAD ||
    a.top > b.bottom + PAD
  )
}

export function deconflictLabels() {
  const contenders: LabelEntry[] = []
  for (const entry of labels.values()) {
    if (!entry.el || entry.wants <= FLOOR) {
      entry.allowed = true
      continue
    }
    contenders.push(entry)
  }

  contenders.sort((a, b) => b.priority - a.priority)

  const placed: Box[] = []
  for (const entry of contenders) {
    const r = entry.el!.getBoundingClientRect()
    if (r.width === 0) {
      entry.allowed = true
      continue
    }
    const box: Box = { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    const clash = placed.some((p) => overlaps(box, p))
    entry.allowed = !clash
    if (!clash) placed.push(box)
  }
}

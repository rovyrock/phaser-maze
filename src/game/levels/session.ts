import type { DiffItem, LevelFile } from './types'

export type Phase = 'play' | 'won' | 'lost'

export type PlayResult =
  | { type: 'ignored' }
  | { type: 'empty' }
  | { type: 'already' }
  | { type: 'found'; itemId: string; displayName: string }

export interface HintResult {
  itemId: string
  tip: string
  x: number
  y: number
  radius: number
}

export function differenceAt(items: DiffItem[], x: number, y: number): DiffItem | null {
  let best: DiffItem | null = null
  let bestDist = Infinity
  for (const item of items) {
    const dx = x - item.x
    const dy = y - item.y
    const dist = dx * dx + dy * dy
    if (dist <= item.radius * item.radius && dist < bestDist) {
      best = item
      bestDist = dist
    }
  }
  return best
}

export class LevelSession {
  remainingMs: number
  readonly found = new Set<string>()
  hintsLeft = 3
  phase: Phase = 'play'
  private paused = false

  constructor(readonly level: LevelFile) {
    this.remainingMs = level.level.totalTime * 1000
  }

  tap(itemId: string | null): PlayResult {
    if (this.phase !== 'play') return { type: 'ignored' }
    if (!itemId) return { type: 'empty' }
    const item = this.level.items.find((entry) => entry.itemId === itemId)
    if (!item) return { type: 'empty' }
    if (this.found.has(item.itemId)) return { type: 'already' }
    this.found.add(item.itemId)
    if (this.found.size === this.level.level.targetCount) this.phase = 'won'
    return { type: 'found', itemId: item.itemId, displayName: item.displayName }
  }

  tick(deltaMs: number) {
    if (this.paused || this.phase !== 'play') return
    this.remainingMs = Math.max(0, this.remainingMs - deltaMs)
    if (this.remainingMs === 0) this.phase = 'lost'
  }

  hint(): HintResult | null {
    if (this.hintsLeft <= 0 || this.phase !== 'play') return null
    const item = [...this.level.items]
      .filter((entry) => !this.found.has(entry.itemId))
      .sort((a, b) => a.order - b.order)[0]
    if (!item) return null
    this.hintsLeft -= 1
    return { itemId: item.itemId, tip: item.tip, x: item.x, y: item.y, radius: item.radius }
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
  }
}

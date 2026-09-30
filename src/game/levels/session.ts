import type { LevelFile, SpotItem } from './types'

export type Phase = 'play' | 'bigImage' | 'won' | 'lost'

export type PlayResult =
  | { type: 'ignored' }
  | { type: 'empty' }
  | { type: 'already' }
  | { type: 'collected'; itemId: string; dialogueText: string }
  | { type: 'openBig'; itemId: string; nodeName: string; autoDismissSec: number }
  | { type: 'changed'; itemId: string; dialogueText: string; show: string; hide: string }

export interface HintResult {
  itemId: string
  tip: string
  nodeName: string
}

export class LevelSession {
  remainingMs: number
  readonly found = new Set<string>()
  hintsLeft = 3
  phase: Phase = 'play'
  inputLocked = false
  readonly visibleNodes: Set<string>
  private paused = false
  private pendingItemId: string | null = null
  unlockArmed = false

  constructor(readonly level: LevelFile) {
    this.remainingMs = level.level.totalTime * 1000
    this.visibleNodes = new Set(
      level.layout.nodes.filter((node) => node.visible).map((node) => node.name),
    )
    for (const item of level.items) {
      if (item.logic.type === 'bigImage') {
        const big = nodeName(item, 'big')
        if (big) this.visibleNodes.delete(big)
      }
      if (item.logic.type === 'clickChangeCollect') {
        const before = nodeName(item, 'before')
        const after = nodeName(item, 'after')
        if (before) this.visibleNodes.add(before)
        if (after) this.visibleNodes.delete(after)
      }
    }
  }

  tap(nodeNameValue: string): PlayResult {
    if (this.phase !== 'play' || this.inputLocked) return { type: 'ignored' }
    const item = this.level.items.find((entry) => nodeName(entry, 'collect') === nodeNameValue)
    if (!item) return { type: 'empty' }
    if (this.found.has(item.itemId)) return { type: 'already' }
    if (item.logic.type === 'bigImage') {
      const big = nodeName(item, 'big')
      if (!big) return { type: 'ignored' }
      this.phase = 'bigImage'
      this.inputLocked = true
      this.pendingItemId = item.itemId
      this.visibleNodes.add(big)
      return {
        type: 'openBig',
        itemId: item.itemId,
        nodeName: big,
        autoDismissSec: item.logic.autoDismissSec ?? 2,
      }
    }
    if (item.logic.type === 'clickChangeCollect') {
      const before = nodeName(item, 'before')
      const after = nodeName(item, 'after')
      if (before) this.visibleNodes.delete(before)
      if (after) this.visibleNodes.add(after)
      this.collect(item)
      return {
        type: 'changed',
        itemId: item.itemId,
        dialogueText: item.dialogueText,
        show: after ?? '',
        hide: before ?? '',
      }
    }
    this.collect(item)
    return { type: 'collected', itemId: item.itemId, dialogueText: item.dialogueText }
  }

  dismissBigImage(): PlayResult {
    if (this.phase !== 'bigImage' || !this.pendingItemId) return { type: 'ignored' }
    const item = this.level.items.find((entry) => entry.itemId === this.pendingItemId)
    if (!item) return { type: 'ignored' }
    const big = nodeName(item, 'big')
    if (big) this.visibleNodes.delete(big)
    this.pendingItemId = null
    this.collect(item)
    if (this.found.size < this.level.level.targetCount) {
      this.inputLocked = true
      this.unlockArmed = true
    }
    return { type: 'collected', itemId: item.itemId, dialogueText: item.dialogueText }
  }

  releaseInputLock() {
    if (this.unlockArmed && this.phase === 'play') {
      this.inputLocked = false
      this.unlockArmed = false
    }
  }

  tick(deltaMs: number) {
    if (this.paused || this.phase !== 'play') return
    this.remainingMs = Math.max(0, this.remainingMs - deltaMs)
    if (this.remainingMs === 0) this.phase = 'lost'
  }

  hint(): HintResult | null {
    if (this.hintsLeft <= 0 || this.phase !== 'play' || this.inputLocked) return null
    const item = [...this.level.items]
      .filter((entry) => entry.needCollect !== false && !this.found.has(entry.itemId))
      .sort((a, b) => a.order - b.order)[0]
    if (!item) return null
    const name = nodeName(item, 'collect')
    if (!name) return null
    this.hintsLeft -= 1
    return { itemId: item.itemId, tip: item.tip, nodeName: name }
  }

  pause() {
    this.paused = true
  }

  resume() {
    this.paused = false
  }

  private collect(item: SpotItem) {
    if (item.needCollect === false) return
    this.found.add(item.itemId)
    if (this.found.size >= this.level.level.targetCount) {
      this.phase = 'won'
      this.inputLocked = true
    } else if (this.phase === 'bigImage') {
      this.phase = 'play'
    }
  }
}

function nodeName(item: SpotItem, key: string) {
  const value = item.logic.nodes[key]
  return typeof value === 'string' ? value : undefined
}

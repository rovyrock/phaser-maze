import type { ContentConfig } from '../levels/types'

export interface Progress {
  cleared: string[]
}

export interface LevelCache {
  get(key: string): string | null
  put(key: string, localUrl: string): void
}

export interface Platform {
  content: ContentConfig
  cache: LevelCache
  loadProgress(): Progress
  saveProgress(progress: Progress): void
  onHide(listener: () => void): () => void
  onShow(listener: () => void): () => void
  loadLevelFile(url: string): Promise<unknown>
  loadLevelBinary(url: string): Promise<string>
}

export function readProgress(raw: string | null): Progress {
  if (!raw) return { cleared: [] }
  try {
    const parsed = JSON.parse(raw) as Progress
    if (!Array.isArray(parsed.cleared)) return { cleared: [] }
    return { cleared: parsed.cleared.filter((id) => typeof id === 'string') }
  } catch {
    return { cleared: [] }
  }
}

export function markCleared(progress: Progress, resourceId: string): Progress {
  if (progress.cleared.includes(resourceId)) return progress
  return { cleared: [...progress.cleared, resourceId] }
}

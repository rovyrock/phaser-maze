import { readProgress, type LevelCache, type Platform, type Progress } from './types'
import type { ContentConfig } from '../levels/types'

const PROGRESS_KEY = 'phaser-maze.progress'

export class MemoryLevelCache implements LevelCache {
  private readonly entries = new Map<string, string>()

  get(key: string) {
    return this.entries.get(key) ?? null
  }

  put(key: string, localUrl: string) {
    this.entries.set(key, localUrl)
  }
}

export function createWebPlatform(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): Platform {
  const params = new URLSearchParams(globalThis.location?.search ?? '')
  const root = (params.get('content') ?? '/content').replace(/\/+$/, '')
  const content: ContentConfig = {
    catalogUrl: `${root}/catalog.json`,
    levelBaseUrl: `${root}/levels`,
  }
  const cache = new MemoryLevelCache()
  const hide = new Set<() => void>()
  const show = new Set<() => void>()
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      const bucket = document.hidden ? hide : show
      for (const listener of bucket) listener()
    })
  }
  return {
    content,
    cache,
    loadProgress() {
      return readProgress(storage.getItem(PROGRESS_KEY))
    },
    saveProgress(progress: Progress) {
      storage.setItem(PROGRESS_KEY, JSON.stringify(progress))
    },
    onHide(listener) {
      hide.add(listener)
      return () => hide.delete(listener)
    },
    onShow(listener) {
      show.add(listener)
      return () => show.delete(listener)
    },
    async loadLevelFile(url: string) {
      const response = await fetch(url, { cache: 'reload' })
      if (!response.ok) throw new Error(`关卡加载失败 ${response.status}`)
      return response.json() as Promise<unknown>
    },
    async loadLevelBinary(url: string) {
      return url
    },
  }
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

export const webPlatform = createWebPlatform(typeof localStorage === 'undefined' ? memoryStorage() : localStorage)

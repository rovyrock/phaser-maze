export interface AssetRef {
  slot: string
  path: string
  key: string
  sha256?: string
}

export interface DiffItem {
  itemId: string
  order: number
  slug: string
  displayName: string
  tip: string
  x: number
  y: number
  radius: number
}

export interface LevelFile {
  schemaVersion: 'diff-level-phaser-v1'
  gameCode: string
  level: {
    resourceId: string
    configId: number
    title: string
    description: string
    type: 'diff'
    targetCount: number
    totalTime: number
    picture: { width: number; height: number }
  }
  pictures: { top: AssetRef; bottom: AssetRef }
  items: DiffItem[]
}

export interface ContentConfig {
  catalogUrl: string
  levelBaseUrl: string
}

export interface CatalogLevel {
  resourceId: string
  title: string
  order: number
}

export interface Catalog {
  schemaVersion: 'spot-catalog-v1'
  levels: CatalogLevel[]
}

export interface LevelAssetUrl {
  key: string
  url: string
  kind: 'image' | 'audio' | 'json'
  sha256?: string
}

export class LevelValidationError extends Error {
  constructor(message: string, itemId?: string) {
    super(itemId ? `${itemId}: ${message}` : message)
    this.name = 'LevelValidationError'
  }
}

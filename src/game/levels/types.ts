export interface AssetRef {
  slot: string
  path: string
  key: string
  originalName?: string
  mime?: string
  sha256?: string
}

export type LogicType =
  | 'directClick'
  | 'bigImage'
  | 'swipeRevealCollect'
  | 'swipeRevealBigImage'
  | 'clickChangeCollect'
  | 'doubleClick'
  | 'dragToTarget'
  | 'animationThenCollect'
  | 'dialogueChoice'

export interface ItemLogic {
  type: LogicType
  nodes: Record<string, string | string[]>
  hideAtStart?: string[]
  revealNodes?: string[]
  hideNodes?: string[]
  effectAudioKey?: string
  collectTiming?: string
  autoDismissSec?: number
  direction?: 'left' | 'right' | 'up' | 'down'
  minDistance?: number
  maxDeviationDistance?: number
  maxIntervalMs?: number
  returnOnMiss?: boolean
}

export interface SpotItem {
  itemId: string
  order: number
  slug: string
  displayName: string
  collectText: string
  tip: string
  dialogueText: string
  needCollect?: boolean
  assets: Partial<
    Record<
      'collectImage' | 'beforeImage' | 'afterImage' | 'bigImage' | 'playAudio' | 'effectAudio',
      AssetRef
    >
  >
  logic: ItemLogic
}

export interface RectHit {
  kind: 'rect'
  x: number
  y: number
  width: number
  height: number
}

export interface CircleHit {
  kind: 'circle'
  x: number
  y: number
  radius: number
}

export interface PolygonHit {
  kind: 'polygon'
  points: Array<[number, number]>
}

export type HitShape = RectHit | CircleHit | PolygonHit

export interface SceneNode {
  name: string
  x: number
  y: number
  depth: number
  visible: boolean
  imageKey?: string
  hit?: HitShape
}

export interface LevelFile {
  schemaVersion: 'spot-level-phaser-v1'
  gameCode: string
  level: {
    resourceId: string
    configId: number
    title: string
    description: string
    type: 'collect'
    targetCount: number
    totalTime: number
  }
  items: SpotItem[]
  layout: {
    background: AssetRef
    nodes: SceneNode[]
  }
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
  kind: 'image' | 'audio'
  sha256?: string
}

export class LevelValidationError extends Error {
  readonly itemId?: string

  constructor(message: string, itemId?: string) {
    super(itemId ? `${itemId}: ${message}` : message)
    this.name = 'LevelValidationError'
    this.itemId = itemId
  }
}

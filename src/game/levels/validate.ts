import {
  LevelFile,
  LevelValidationError,
  type AssetRef,
  type HitShape,
  type SceneNode,
  type SpotItem,
} from './types'

const SUPPORTED = new Set(['directClick', 'bigImage', 'clickChangeCollect'])
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/
const RESOURCE = /^[0-9]{3}$/

const AUDIO_SLOTS = new Set(['playAudio', 'effectAudio'])

export function validateLevel(raw: unknown): LevelFile {
  const level = asRecord(raw, '关卡')
  if (level.schemaVersion !== 'spot-level-phaser-v1') {
    throw new LevelValidationError('schemaVersion 必须是 spot-level-phaser-v1')
  }
  if (typeof level.gameCode !== 'string' || level.gameCode.length === 0) {
    throw new LevelValidationError('gameCode 必填')
  }
  const meta = asRecord(level.level, 'level')
  if (typeof meta.resourceId !== 'string' || !RESOURCE.test(meta.resourceId)) {
    throw new LevelValidationError('resourceId 必须是三位数字')
  }
  if (!Number.isInteger(meta.configId) || (meta.configId as number) <= 0) {
    throw new LevelValidationError('configId 必须是正整数')
  }
  if (meta.type !== 'collect') throw new LevelValidationError('type 只接受 collect')
  requireText(meta, 'title')
  requireText(meta, 'description')
  if (!Number.isFinite(meta.totalTime) || (meta.totalTime as number) <= 0) {
    throw new LevelValidationError('totalTime 必须大于 0')
  }
  if (!Array.isArray(level.items) || level.items.length === 0) {
    throw new LevelValidationError('items 不能为空')
  }
  const layout = asRecord(level.layout, 'layout')
  const background = readAsset(layout.background, 'background')
  if (!Array.isArray(layout.nodes)) throw new LevelValidationError('layout.nodes 必须是数组')
  const nodes = layout.nodes.map((node) => readNode(node))
  const nodeByName = new Map(nodes.map((node) => [node.name, node]))
  if (nodeByName.size !== nodes.length) throw new LevelValidationError('节点名重复')

  const items = level.items.map((item) => readItem(item))
  assertUnique(items.map((item) => item.itemId), 'itemId')
  assertUnique(items.map((item) => item.slug), 'slug')
  assertUnique(items.map((item) => String(item.order)), 'order')

  const collectCount = items.filter((item) => item.needCollect !== false).length
  if (meta.targetCount !== collectCount) {
    throw new LevelValidationError('targetCount 与需要收集的茬点数不一致')
  }

  const keys = new Set<string>([background.key])
  for (const item of items) {
    for (const asset of Object.values(item.assets)) {
      if (!asset) continue
      if (keys.has(asset.key)) throw new LevelValidationError('资源 key 重复', item.itemId)
      keys.add(asset.key)
    }
    assertLogic(item, nodeByName)
  }

  return {
    schemaVersion: 'spot-level-phaser-v1',
    gameCode: level.gameCode,
    level: {
      resourceId: meta.resourceId,
      configId: meta.configId as number,
      title: meta.title as string,
      description: meta.description as string,
      type: 'collect',
      targetCount: meta.targetCount as number,
      totalTime: meta.totalTime as number,
    },
    items,
    layout: { background, nodes },
  }
}

function assertLogic(item: SpotItem, nodes: Map<string, SceneNode>) {
  const type = item.logic.type
  if (!SUPPORTED.has(type)) {
    throw new LevelValidationError(`尚未支持 ${type}`, item.itemId)
  }
  const collect = requireNode(item, 'collect', nodes)
  if (!collect.hit) throw new LevelValidationError('可点节点缺少热区', item.itemId)
  if (!item.assets.collectImage) throw new LevelValidationError('缺少 collectImage', item.itemId)
  if (type === 'bigImage') {
    requireNode(item, 'big', nodes)
    if (!item.assets.bigImage) throw new LevelValidationError('缺少 bigImage', item.itemId)
  }
  if (type === 'clickChangeCollect') {
    requireNode(item, 'before', nodes)
    requireNode(item, 'after', nodes)
    if (!item.assets.beforeImage || !item.assets.afterImage) {
      throw new LevelValidationError('缺少前后状态图', item.itemId)
    }
  }
}

function requireNode(item: SpotItem, key: string, nodes: Map<string, SceneNode>) {
  const name = item.logic.nodes[key]
  if (typeof name !== 'string' || !nodes.has(name)) {
    throw new LevelValidationError(`缺少节点 ${key}`, item.itemId)
  }
  return nodes.get(name)!
}

function readItem(raw: unknown): SpotItem {
  const item = asRecord(raw, 'item')
  const itemId = requireText(item, 'itemId')
  if (!Number.isInteger(item.order) || (item.order as number) < 1) {
    throw new LevelValidationError('order 必须从 1 开始', itemId)
  }
  const slug = requireText(item, 'slug', itemId)
  if (!SLUG.test(slug)) throw new LevelValidationError('slug 不合法', itemId)
  const logic = asRecord(item.logic, 'logic', itemId)
  if (typeof logic.type !== 'string') throw new LevelValidationError('logic.type 必填', itemId)
  if (!isRecord(logic.nodes)) throw new LevelValidationError('logic.nodes 必填', itemId)
  const assetsIn = asRecord(item.assets, 'assets', itemId)
  const assets: SpotItem['assets'] = {}
  for (const [slot, value] of Object.entries(assetsIn)) {
    if (value === undefined) continue
    assets[slot as keyof SpotItem['assets']] = readAsset(value, slot, itemId)
  }
  return {
    itemId,
    order: item.order as number,
    slug,
    displayName: requireText(item, 'displayName', itemId),
    collectText: requireText(item, 'collectText', itemId),
    tip: requireText(item, 'tip', itemId),
    dialogueText: requireText(item, 'dialogueText', itemId),
    needCollect: item.needCollect === undefined ? true : Boolean(item.needCollect),
    assets,
    logic: {
      type: logic.type as SpotItem['logic']['type'],
      nodes: logic.nodes as SpotItem['logic']['nodes'],
      autoDismissSec: typeof logic.autoDismissSec === 'number' ? logic.autoDismissSec : undefined,
      collectTiming: typeof logic.collectTiming === 'string' ? logic.collectTiming : undefined,
    },
  }
}

function readNode(raw: unknown): SceneNode {
  const node = asRecord(raw, 'node')
  if (typeof node.name !== 'string' || node.name.length === 0) {
    throw new LevelValidationError('节点缺少 name')
  }
  return {
    name: node.name,
    x: numberField(node, 'x'),
    y: numberField(node, 'y'),
    depth: numberField(node, 'depth'),
    visible: Boolean(node.visible),
    imageKey: typeof node.imageKey === 'string' ? node.imageKey : undefined,
    hit: node.hit === undefined ? undefined : readHit(node.hit),
  }
}

function readHit(raw: unknown): HitShape {
  const hit = asRecord(raw, 'hit')
  if (hit.kind === 'rect') {
    return {
      kind: 'rect',
      x: numberField(hit, 'x'),
      y: numberField(hit, 'y'),
      width: numberField(hit, 'width'),
      height: numberField(hit, 'height'),
    }
  }
  if (hit.kind === 'circle') {
    return {
      kind: 'circle',
      x: numberField(hit, 'x'),
      y: numberField(hit, 'y'),
      radius: numberField(hit, 'radius'),
    }
  }
  if (hit.kind === 'polygon' && Array.isArray(hit.points)) {
    return { kind: 'polygon', points: hit.points as Array<[number, number]> }
  }
  throw new LevelValidationError('热区类型无法识别')
}

function readAsset(raw: unknown, slot: string, itemId?: string): AssetRef {
  const asset = asRecord(raw, slot, itemId)
  const path = requireText(asset, 'path', itemId)
  if (!path.startsWith('assets/') || path.includes('..')) {
    throw new LevelValidationError(`${slot} 路径必须以 assets/ 开头`, itemId)
  }
  const key = requireText(asset, 'key', itemId)
  if (AUDIO_SLOTS.has(slot) && asset.slot !== slot && asset.slot !== undefined) {
    throw new LevelValidationError(`${slot} 与声明不一致`, itemId)
  }
  return {
    slot,
    path,
    key,
    sha256: typeof asset.sha256 === 'string' ? asset.sha256 : undefined,
  }
}

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new LevelValidationError(`${label} 重复`)
  }
}

function requireText(record: Record<string, unknown>, key: string, itemId?: string) {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new LevelValidationError(`${key} 必填`, itemId)
  }
  return value
}

function numberField(record: Record<string, unknown>, key: string) {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LevelValidationError(`${key} 必须是数字`)
  }
  return value
}

function asRecord(raw: unknown, label: string, itemId?: string): Record<string, unknown> {
  if (!isRecord(raw)) throw new LevelValidationError(`${label} 必须是对象`, itemId)
  return raw
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
}

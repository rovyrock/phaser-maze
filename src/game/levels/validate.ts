import { LevelValidationError, type AssetRef, type DiffItem, type LevelFile } from './types'

const RESOURCE_ID = /^[0-9]{3}$/
const SLUG = /^[a-z0-9]+([_-][a-z0-9]+)*$/

export function validateLevel(raw: unknown): LevelFile {
  const record = asRecord(raw, '关卡')
  if (record.schemaVersion !== 'diff-level-phaser-v1') {
    throw new LevelValidationError('schemaVersion 必须是 diff-level-phaser-v1')
  }
  if (typeof record.gameCode !== 'string' || record.gameCode.length === 0) {
    throw new LevelValidationError('gameCode 必填')
  }
  const level = asRecord(record.level, 'level')
  const resourceId = requireText(level, 'resourceId')
  if (!RESOURCE_ID.test(resourceId)) throw new LevelValidationError('resourceId 必须是三位数字')
  if (!Number.isInteger(level.configId) || (level.configId as number) < 1) {
    throw new LevelValidationError('configId 必须是正整数')
  }
  if (level.type !== 'diff') throw new LevelValidationError('type 必须是 diff')
  if (!Number.isInteger(level.totalTime) || (level.totalTime as number) < 1) {
    throw new LevelValidationError('totalTime 必须是正整数')
  }
  const picture = asRecord(level.picture, 'picture')
  const width = positiveInt(picture.width, 'picture.width')
  const height = positiveInt(picture.height, 'picture.height')
  const pictures = asRecord(record.pictures, 'pictures')
  const top = readAsset(pictures.top, 'top')
  const bottom = readAsset(pictures.bottom, 'bottom')
  if (top.key === bottom.key) throw new LevelValidationError('上下图 key 不能相同')
  if (!Array.isArray(record.items) || record.items.length === 0) {
    throw new LevelValidationError('没有不同处')
  }
  const items = record.items.map((entry) => readItem(entry, width, height))
  assertUnique(items.map((item) => item.itemId), 'itemId')
  assertUnique(items.map((item) => item.slug), 'slug')
  assertUnique(items.map((item) => String(item.order)), 'order')
  if (level.targetCount !== items.length) {
    throw new LevelValidationError('targetCount 必须等于不同处个数')
  }
  return {
    schemaVersion: 'diff-level-phaser-v1',
    gameCode: record.gameCode,
    level: {
      resourceId,
      configId: level.configId as number,
      title: requireText(level, 'title'),
      description: requireText(level, 'description'),
      type: 'diff',
      targetCount: items.length,
      totalTime: level.totalTime as number,
      picture: { width, height },
    },
    pictures: { top, bottom },
    items,
  }
}

function readItem(raw: unknown, width: number, height: number): DiffItem {
  const item = asRecord(raw, 'item')
  const itemId = requireText(item, 'itemId')
  if (!Number.isInteger(item.order) || (item.order as number) < 1) {
    throw new LevelValidationError('order 必须从 1 开始', itemId)
  }
  const slug = requireText(item, 'slug', itemId)
  if (!SLUG.test(slug)) throw new LevelValidationError('slug 不合法', itemId)
  const x = numberField(item, 'x', itemId)
  const y = numberField(item, 'y', itemId)
  const radius = numberField(item, 'radius', itemId)
  if (radius <= 0) throw new LevelValidationError('radius 必须为正', itemId)
  if (x < 0 || y < 0 || x > width || y > height) {
    throw new LevelValidationError('圆心超出图片', itemId)
  }
  return {
    itemId,
    order: item.order as number,
    slug,
    displayName: requireText(item, 'displayName', itemId),
    tip: requireText(item, 'tip', itemId),
    x,
    y,
    radius,
  }
}

function readAsset(raw: unknown, slot: string): AssetRef {
  const asset = asRecord(raw, slot)
  const path = requireText(asset, 'path')
  if (!path.startsWith('assets/') || path.includes('..')) {
    throw new LevelValidationError(`${slot} 路径必须以 assets/ 开头`)
  }
  const key = requireText(asset, 'key')
  return {
    slot,
    path,
    key,
    sha256: typeof asset.sha256 === 'string' ? asset.sha256 : undefined,
  }
}

function assertUnique(values: string[], label: string) {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) throw new LevelValidationError(`${label} 重复`)
    seen.add(value)
  }
}

function positiveInt(value: unknown, label: string) {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new LevelValidationError(`${label} 必须是正整数`)
  }
  return value as number
}

function numberField(record: Record<string, unknown>, key: string, itemId?: string) {
  if (typeof record[key] !== 'number' || Number.isNaN(record[key])) {
    throw new LevelValidationError(`${key} 必须是数字`, itemId)
  }
  return record[key] as number
}

function requireText(record: Record<string, unknown>, key: string, itemId?: string) {
  if (typeof record[key] !== 'string' || record[key].length === 0) {
    throw new LevelValidationError(`${key} 必填`, itemId)
  }
  return record[key]
}

function asRecord(raw: unknown, label: string) {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new LevelValidationError(`${label} 必须是对象`)
  }
  return raw as Record<string, unknown>
}

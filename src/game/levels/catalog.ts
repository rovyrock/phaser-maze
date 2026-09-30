import { LevelValidationError, type Catalog, type CatalogLevel } from './types'

export function parseCatalog(raw: unknown): Catalog {
  if (typeof raw !== 'object' || raw === null) {
    throw new LevelValidationError('目录必须是对象')
  }
  const record = raw as Record<string, unknown>
  if (record.schemaVersion !== 'spot-catalog-v1') {
    throw new LevelValidationError('目录 schemaVersion 必须是 spot-catalog-v1')
  }
  if (!Array.isArray(record.levels) || record.levels.length === 0) {
    throw new LevelValidationError('目录没有关卡')
  }
  const levels = record.levels.map((entry) => {
    const level = entry as Record<string, unknown>
    if (typeof level.resourceId !== 'string' || typeof level.title !== 'string') {
      throw new LevelValidationError('目录条目缺少 resourceId 或 title')
    }
    if (!Number.isInteger(level.order)) throw new LevelValidationError('目录 order 必须是整数')
    return {
      resourceId: level.resourceId,
      title: level.title,
      order: level.order as number,
    }
  })
  return {
    schemaVersion: 'spot-catalog-v1',
    levels: [...levels].sort((a, b) => a.order - b.order),
  }
}

export function isUnlocked(levels: CatalogLevel[], resourceId: string, cleared: string[]) {
  const index = levels.findIndex((level) => level.resourceId === resourceId)
  if (index < 0) return false
  if (index === 0) return true
  return cleared.includes(levels[index - 1]!.resourceId)
}

export function continueTarget(levels: CatalogLevel[], cleared: string[]) {
  const next = levels.find((level) => isUnlocked(levels, level.resourceId, cleared) && !cleared.includes(level.resourceId))
  return (next ?? levels[levels.length - 1])?.resourceId
}

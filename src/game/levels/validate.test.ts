import { describe, expect, it } from 'vitest'
import sampleJson from '../../../docs/samples/level-001.json'
import { LevelValidationError, type LevelFile } from './types'
import { validateLevel } from './validate'

function sample(): LevelFile {
  return structuredClone(sampleJson) as LevelFile
}

describe('validateLevel', () => {
  it('接受第一关样例', () => {
    const level = validateLevel(sample())
    expect(level.level.type).toBe('diff')
    expect(level.level.targetCount).toBe(level.items.length)
    expect(level.pictures.top.key).not.toBe(level.pictures.bottom.key)
  })

  it('拒绝不一致的目标数', () => {
    const broken = sample()
    broken.level.targetCount = 1
    expect(() => validateLevel(broken)).toThrow(LevelValidationError)
  })

  it('接受带下划线的 slug', () => {
    const level = sample()
    level.items[0]!.slug = 'cat_patch'
    level.items[1]!.slug = 'chairL'
    expect(validateLevel(level).items.map((item) => item.slug)).toEqual(['cat_patch', 'chairL', 'patch', 'flower', 'bell'])
  })

  it('拒绝重复 slug', () => {
    const broken = sample()
    broken.items[1]!.slug = broken.items[0]!.slug
    expect(() => validateLevel(broken)).toThrow(/slug 重复/)
  })

  it('拒绝超出图片的圆心', () => {
    const broken = sample()
    broken.items[0]!.x = broken.level.picture.width + 10
    expect(() => validateLevel(broken)).toThrow(/圆心超出图片/)
  })

  it('拒绝旧的单张场景 schema', () => {
    const broken = sample()
    broken.schemaVersion = 'spot-level-phaser-v1' as LevelFile['schemaVersion']
    expect(() => validateLevel(broken)).toThrow(/diff-level-phaser-v1/)
  })
})

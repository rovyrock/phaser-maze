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
    expect(level.level.targetCount).toBe(3)
    expect(level.items).toHaveLength(3)
  })

  it('拒绝不一致的目标数', () => {
    const broken = sample()
    broken.level.targetCount = 2
    expect(() => validateLevel(broken)).toThrow(LevelValidationError)
  })

  it('拒绝重复 slug', () => {
    const broken = sample()
    broken.items[1]!.slug = broken.items[0]!.slug
    expect(() => validateLevel(broken)).toThrow(/slug 重复/)
  })

  it('拒绝没有热区的可点节点', () => {
    const broken = sample()
    broken.layout.nodes[0]!.hit = undefined
    expect(() => validateLevel(broken)).toThrow(/item_001/)
  })

  it('把尚未实现的触发标成尚未支持', () => {
    const broken = sample()
    broken.items[0]!.logic.type = 'swipeRevealCollect'
    expect(() => validateLevel(broken)).toThrow(/尚未支持 swipeRevealCollect/)
  })

  it('拒绝非法资源号', () => {
    const broken = sample()
    broken.level.resourceId = '1'
    expect(() => validateLevel(broken)).toThrow(/resourceId/)
  })
})

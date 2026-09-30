import { describe, expect, it } from 'vitest'
import { differenceAt, LevelSession } from './session'
import { validateLevel } from './validate'
import type { LevelFile } from './types'

function level(): LevelFile {
  return validateLevel({
    schemaVersion: 'diff-level-phaser-v1',
    gameCode: 'test',
    level: {
      resourceId: '001',
      configId: 1,
      title: '测试',
      description: '测试',
      type: 'diff',
      targetCount: 2,
      totalTime: 10,
      picture: { width: 100, height: 80 },
    },
    pictures: {
      top: { slot: 'top', path: 'assets/images/top.png', key: 'top' },
      bottom: { slot: 'bottom', path: 'assets/images/bottom.png', key: 'bottom' },
    },
    items: [
      { itemId: 'item_001', order: 1, slug: 'ball', displayName: '球', tip: '看球', x: 20, y: 20, radius: 8 },
      { itemId: 'item_002', order: 2, slug: 'bird', displayName: '鸟', tip: '看鸟', x: 70, y: 40, radius: 6 },
    ],
  })
}

describe('differenceAt', () => {
  it('命中圆内，重叠时取更近的圆心', () => {
    const items = level().items
    expect(differenceAt(items, 22, 21)?.itemId).toBe('item_001')
    expect(differenceAt(items, 0, 0)).toBeNull()
  })
})

describe('LevelSession', () => {
  it('点中后计数，重复点不增加', () => {
    const session = new LevelSession(level())
    expect(session.tap('item_001')).toMatchObject({ type: 'found' })
    expect(session.found.size).toBe(1)
    expect(session.tap('item_001').type).toBe('already')
    expect(session.found.size).toBe(1)
  })

  it('点空不改变进度', () => {
    const session = new LevelSession(level())
    expect(session.tap(null).type).toBe('empty')
    expect(session.found.size).toBe(0)
    expect(session.remainingMs).toBe(10000)
  })

  it('找齐后胜利，胜利后不再接受点击', () => {
    const session = new LevelSession(level())
    session.tap('item_001')
    expect(session.tap('item_002').type).toBe('found')
    expect(session.phase).toBe('won')
    expect(session.tap('item_001').type).toBe('ignored')
  })

  it('提示按顺序给出未找到的位置，最多 3 次', () => {
    const session = new LevelSession(level())
    expect(session.hint()).toMatchObject({ itemId: 'item_001', x: 20, y: 20 })
    session.tap('item_001')
    expect(session.hint()?.itemId).toBe('item_002')
    expect(session.hint()?.itemId).toBe('item_002')
    expect(session.hint()).toBeNull()
  })

  it('暂停时不扣时间，时间到则失败', () => {
    const session = new LevelSession(level())
    session.pause()
    session.tick(5000)
    expect(session.remainingMs).toBe(10000)
    session.resume()
    session.tick(10000)
    expect(session.phase).toBe('lost')
    expect(session.tap('item_001').type).toBe('ignored')
  })
})

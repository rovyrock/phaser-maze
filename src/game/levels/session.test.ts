import { describe, expect, it } from 'vitest'
import { LevelSession } from './session'
import { validateLevel } from './validate'
import type { LevelFile } from './types'

function level(): LevelFile {
  return validateLevel({
    schemaVersion: 'spot-level-phaser-v1',
    gameCode: 'test',
    level: {
      resourceId: '001',
      configId: 1,
      title: '测试',
      description: '测试',
      type: 'collect',
      targetCount: 3,
      totalTime: 10,
    },
    items: [
      item('item_001', 1, 'directClick', { collect: 'spot-a' }),
      item('item_002', 2, 'bigImage', { collect: 'spot-b', big: 'big-b' }, { bigImage: asset('big-b', 'assets/images/big/b.png') }),
      item('item_003', 3, 'clickChangeCollect', { collect: 'spot-c', before: 'before-c', after: 'after-c' }, {
        beforeImage: asset('before-c', 'assets/images/before/c.png'),
        afterImage: asset('after-c', 'assets/images/after/c.png'),
      }),
    ],
    layout: {
      background: asset('bg', 'assets/images/bg/desk.png'),
      nodes: [
        node('spot-a', true, true),
        node('spot-b', true, true),
        node('big-b', false, false),
        node('spot-c', true, true),
        node('before-c', true, false),
        node('after-c', true, false),
      ],
    },
  })
}

function asset(key: string, path: string) {
  return { slot: key, path, key }
}

function item(
  itemId: string,
  order: number,
  type: string,
  nodes: Record<string, string>,
  extraAssets: Record<string, ReturnType<typeof asset>> = {},
) {
  return {
    itemId,
    order,
    slug: `spot-${order}`,
    displayName: itemId,
    collectText: itemId,
    tip: `提示${order}`,
    dialogueText: `对白${order}`,
    needCollect: true,
    assets: { collectImage: asset(itemId, `assets/images/collect/${itemId}.png`), ...extraAssets },
    logic: { type, nodes },
  }
}

function node(name: string, visible: boolean, hit: boolean) {
  return {
    name,
    x: 10,
    y: 10,
    depth: 1,
    visible,
    hit: hit ? { kind: 'rect', x: 0, y: 0, width: 20, height: 20 } : undefined,
  }
}

describe('LevelSession', () => {
  it('直接点击后收集，重复点击不计数', () => {
    const session = new LevelSession(level())
    expect(session.tap('spot-a')).toMatchObject({ type: 'collected', itemId: 'item_001' })
    expect(session.found.has('item_001')).toBe(true)
    expect(session.tap('spot-a')).toMatchObject({ type: 'already' })
    expect(session.found.size).toBe(1)
  })

  it('点空不改变进度和时间', () => {
    const session = new LevelSession(level())
    expect(session.tap('missing')).toMatchObject({ type: 'empty' })
    expect(session.found.size).toBe(0)
    expect(session.remainingMs).toBe(10_000)
  })

  it('大图打开时锁操作，关闭后才收集，下一帧才解锁', () => {
    const session = new LevelSession(level())
    expect(session.tap('spot-b')).toMatchObject({ type: 'openBig', autoDismissSec: 2 })
    expect(session.phase).toBe('bigImage')
    expect(session.visibleNodes.has('big-b')).toBe(true)
    expect(session.tap('spot-a')).toMatchObject({ type: 'ignored' })
    session.tick(1000)
    expect(session.remainingMs).toBe(10_000)
    expect(session.dismissBigImage()).toMatchObject({ type: 'collected', itemId: 'item_002' })
    expect(session.visibleNodes.has('big-b')).toBe(false)
    expect(session.inputLocked).toBe(true)
    session.releaseInputLock()
    expect(session.inputLocked).toBe(false)
    expect(session.phase).toBe('play')
  })

  it('状态切换会交换前后节点并收集', () => {
    const session = new LevelSession(level())
    expect(session.visibleNodes.has('before-c')).toBe(true)
    expect(session.visibleNodes.has('after-c')).toBe(false)
    expect(session.tap('spot-c')).toMatchObject({ type: 'changed', show: 'after-c', hide: 'before-c' })
    expect(session.visibleNodes.has('after-c')).toBe(true)
    expect(session.found.has('item_003')).toBe(true)
  })

  it('提示按顺序指出未找到的茬点，用完后不再给', () => {
    const session = new LevelSession(level())
    expect(session.hint()).toMatchObject({ itemId: 'item_001', tip: '提示1' })
    session.tap('spot-a')
    expect(session.hint()?.itemId).toBe('item_002')
    session.hint()
    expect(session.hintsLeft).toBe(0)
    expect(session.hint()).toBeNull()
  })

  it('暂停和大图期间不扣时间，时间耗尽判负，收齐判胜', () => {
    const session = new LevelSession(level())
    session.pause()
    session.tick(5000)
    expect(session.remainingMs).toBe(10_000)
    session.resume()
    session.tick(10_000)
    expect(session.phase).toBe('lost')
    expect(session.tap('spot-a')).toMatchObject({ type: 'ignored' })

    const again = new LevelSession(level())
    again.tap('spot-a')
    again.tap('spot-b')
    again.dismissBigImage()
    again.releaseInputLock()
    again.tap('spot-c')
    expect(again.phase).toBe('won')
    again.tick(1000)
    expect(again.remainingMs).toBe(10_000)
  })
})

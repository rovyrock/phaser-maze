import { describe, expect, it } from 'vitest'
import { markCleared, readProgress } from './types'

describe('本地进度', () => {
  it('空记录和坏记录都当成没有通关', () => {
    expect(readProgress(null)).toEqual({ cleared: [] })
    expect(readProgress('{')).toEqual({ cleared: [] })
  })

  it('通关同一关只记一次', () => {
    const once = markCleared({ cleared: [] }, '001')
    expect(markCleared(once, '001')).toBe(once)
    expect(markCleared(once, '002').cleared).toEqual(['001', '002'])
  })
})

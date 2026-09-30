import { describe, expect, it } from 'vitest'
import sampleJson from '../../../docs/samples/level-001.json'
import { levelCacheKey, levelJsonUrl, listLevelAssetUrls, loadingFraction } from './assets'
import { continueTarget, isUnlocked, parseCatalog } from './catalog'
import { validateLevel } from './validate'

const sample = validateLevel(sampleJson)

const config = { catalogUrl: '/content/catalog.json', levelBaseUrl: '/content/levels' }

describe('关卡资源地址', () => {
  it('按关卡目录拼接配置和图片，音频单独标出', () => {
    expect(levelJsonUrl(config.levelBaseUrl, '001')).toBe('/content/levels/001/level.json')
    const urls = listLevelAssetUrls(config, sample)
    expect(urls.map((asset) => asset.url)).toEqual([
      '/content/levels/001/assets/images/bg/desk.png',
      '/content/levels/001/assets/images/collect/clock.png',
      '/content/levels/001/assets/images/collect/photo.png',
      '/content/levels/001/assets/images/collect/cup.png',
    ])
    expect(urls.every((asset) => asset.kind === 'image')).toBe(true)
  })

  it('相同 key 只保留一份', () => {
    const level = structuredClone(sample)
    level.layout.background.key = 'clock'
    level.layout.background.path = 'assets/images/collect/clock.png'
    const urls = listLevelAssetUrls(config, level)
    expect(urls.filter((asset) => asset.key === 'clock')).toHaveLength(1)
  })

  it('加载进度在配置完成后从 10% 按文件均分', () => {
    expect(loadingFraction(false, 0, 4)).toBe(0)
    expect(loadingFraction(true, 0, 4)).toBeCloseTo(0.1)
    expect(loadingFraction(true, 4, 4)).toBeCloseTo(1)
  })

  it('缓存键优先用摘要', () => {
    expect(levelCacheKey('001', { key: 'clock', url: 'http://cdn/clock.png', sha256: 'abc' })).toBe(
      '001:clock:abc',
    )
    expect(levelCacheKey('001', { key: 'clock', url: 'http://cdn/clock.png' })).toBe(
      '001:clock:http://cdn/clock.png',
    )
  })
})

describe('目录解锁', () => {
  const catalog = parseCatalog({
    schemaVersion: 'spot-catalog-v1',
    levels: [
      { resourceId: '002', title: '二', order: 2 },
      { resourceId: '001', title: '一', order: 1 },
    ],
  })

  it('第一关始终可进，后一关要前一关通过', () => {
    expect(isUnlocked(catalog.levels, '001', [])).toBe(true)
    expect(isUnlocked(catalog.levels, '002', [])).toBe(false)
    expect(isUnlocked(catalog.levels, '002', ['001'])).toBe(true)
    expect(continueTarget(catalog.levels, [])).toBe('001')
    expect(continueTarget(catalog.levels, ['001'])).toBe('002')
    expect(continueTarget(catalog.levels, ['001', '002'])).toBe('002')
  })
})

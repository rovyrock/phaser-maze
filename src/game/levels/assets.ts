import type { ContentConfig, LevelAssetUrl, LevelFile } from './types'

const AUDIO_SLOTS = new Set(['playAudio', 'effectAudio'])

export function levelJsonUrl(levelBaseUrl: string, resourceId: string) {
  return `${trimSlash(levelBaseUrl)}/${resourceId}/level.json`
}

export function listLevelAssetUrls(config: ContentConfig, level: LevelFile): LevelAssetUrl[] {
  const root = `${trimSlash(config.levelBaseUrl)}/${level.level.resourceId}`
  const listed: LevelAssetUrl[] = [toUrl(root, level.layout.background, 'image')]
  const seen = new Set<string>([level.layout.background.key])
  for (const item of level.items) {
    for (const [slot, asset] of Object.entries(item.assets)) {
      if (!asset || seen.has(asset.key)) continue
      seen.add(asset.key)
      listed.push(toUrl(root, asset, AUDIO_SLOTS.has(slot) ? 'audio' : 'image'))
    }
  }
  return listed
}

export function levelCacheKey(resourceId: string, asset: { key: string; sha256?: string; url: string }) {
  return `${resourceId}:${asset.key}:${asset.sha256 ?? asset.url}`
}

export function loadingFraction(jsonDone: boolean, filesDone: number, fileCount: number) {
  if (!jsonDone) return 0
  if (fileCount === 0) return 1
  return 0.1 + 0.9 * (filesDone / fileCount)
}

function toUrl(
  root: string,
  asset: { key: string; path: string; sha256?: string },
  kind: LevelAssetUrl['kind'],
): LevelAssetUrl {
  return { key: asset.key, url: `${root}/${asset.path}`, kind, sha256: asset.sha256 }
}

function trimSlash(url: string) {
  return url.replace(/\/+$/, '')
}

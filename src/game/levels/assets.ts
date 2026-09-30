import type { ContentConfig, LevelAssetUrl, LevelFile } from './types'

export function levelJsonUrl(levelBaseUrl: string, resourceId: string) {
  return `${trimSlash(levelBaseUrl)}/${resourceId}/level.json`
}

export function listLevelAssetUrls(config: ContentConfig, level: LevelFile): LevelAssetUrl[] {
  const root = `${trimSlash(config.levelBaseUrl)}/${level.level.resourceId}`
  return [level.pictures.top, level.pictures.bottom].map((asset) => ({
    key: asset.key,
    url: `${root}/${asset.path}`,
    kind: 'image' as const,
    sha256: asset.sha256,
  }))
}

export function levelCacheKey(resourceId: string, asset: { key: string; sha256?: string; url: string }) {
  return `${resourceId}:${asset.key}:${asset.sha256 ?? asset.url}`
}

export function loadingFraction(jsonDone: boolean, filesDone: number, fileCount: number) {
  if (!jsonDone) return 0
  if (fileCount === 0) return 1
  return 0.1 + 0.9 * (filesDone / fileCount)
}

function trimSlash(url: string) {
  return url.replace(/\/+$/, '')
}

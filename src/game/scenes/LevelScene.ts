import Phaser from 'phaser'
import { levelCacheKey, levelJsonUrl, listLevelAssetUrls, loadingFraction } from '../levels/assets'
import { differenceAt, LevelSession, type PlayResult } from '../levels/session'
import { validateLevel } from '../levels/validate'
import type { Catalog, DiffItem, LevelAssetUrl, LevelFile } from '../levels/types'
import { markCleared } from '../platform/types'
import { webPlatform } from '../platform/web'
import { addButton } from './button'

interface LevelStart {
  resourceId: string
  catalog: Catalog
}

interface PanelLayout {
  x: number
  topY: number
  bottomY: number
  width: number
  height: number
  scale: number
}

export class LevelScene extends Phaser.Scene {
  private resourceId = ''
  private catalog: Catalog = { schemaVersion: 'spot-catalog-v1', levels: [] }
  private level: LevelFile | null = null
  private session: LevelSession | null = null
  private textureKeys: string[] = []
  private layout: PanelLayout | null = null
  private titleText!: Phaser.GameObjects.Text
  private countText!: Phaser.GameObjects.Text
  private timeText!: Phaser.GameObjects.Text
  private tipText!: Phaser.GameObjects.Text
  private loadingText!: Phaser.GameObjects.Text
  private marks!: Phaser.GameObjects.Graphics
  private hintMark!: Phaser.GameObjects.Graphics
  private dots!: Phaser.GameObjects.Graphics
  private resultShown = false
  private missedOnce = false
  private saved = false
  private backgrounded = false
  private removeHide = () => {}
  private removeShow = () => {}

  constructor() {
    super('Level')
  }

  init(data: LevelStart) {
    this.resourceId = data.resourceId
    this.catalog = data.catalog
  }

  create() {
    this.input.topOnly = true
    this.textureKeys = []
    this.layout = null
    this.resultShown = false
    this.missedOnce = false
    this.saved = false
    this.session = null
    this.level = null
    this.add.rectangle(375, 667, 750, 1334, 0x1a1714)
    addButton(this, 56, 56, 88, 88, '返回', () => this.scene.start('Home'), 300)
    this.titleText = this.add.text(120, 28, '', { fontFamily: 'sans-serif', fontSize: '36px', color: '#f4f1ea' }).setDepth(300)
    this.countText = this.add.text(120, 74, '', { fontFamily: 'sans-serif', fontSize: '28px', color: '#f4f1ea' }).setDepth(300)
    this.timeText = this.add.text(640, 40, '', { fontFamily: 'sans-serif', fontSize: '36px', color: '#f4f1ea' }).setOrigin(1, 0).setDepth(300)
    this.tipText = this.add.text(375, 128, '', { fontFamily: 'sans-serif', fontSize: '24px', color: '#f6e27a' }).setOrigin(0.5).setDepth(300)
    this.marks = this.add.graphics().setDepth(20)
    this.hintMark = this.add.graphics().setDepth(21)
    this.dots = this.add.graphics().setDepth(20)
    this.loadingText = this.add
      .text(375, 667, '关卡加载中', { fontFamily: 'sans-serif', fontSize: '36px', color: '#f4f1ea' })
      .setOrigin(0.5)
      .setDepth(400)
    addButton(this, 375, 1276, 160, 88, '提示', () => this.useHint(), 300)
    this.removeHide = webPlatform.onHide(() => {
      this.backgrounded = true
      this.session?.pause()
    })
    this.removeShow = webPlatform.onShow(() => {
      this.backgrounded = false
      this.session?.resume()
    })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPointer(pointer))
    void this.loadLevel()
  }

  update(_time: number, delta: number) {
    if (!this.session || this.resultShown) return
    this.session.tick(delta)
    this.refreshHud()
    this.maybeFinish()
  }

  retry() {
    if (!this.level) return
    this.scene.stop('Result')
    this.session = new LevelSession(this.level)
    if (this.backgrounded) this.session.pause()
    this.resultShown = false
    this.missedOnce = false
    this.saved = false
    this.marks.clear()
    this.hintMark.clear()
    this.tipText.setText('')
    this.refreshHud()
    this.paintDots()
  }

  shutdown() {
    this.removeHide()
    this.removeShow()
    for (const key of this.textureKeys) {
      if (this.textures.exists(key)) this.textures.remove(key)
    }
  }

  private async loadLevel() {
    const jsonUrl = levelJsonUrl(webPlatform.content.levelBaseUrl, this.resourceId)
    try {
      const raw = await webPlatform.loadLevelFile(jsonUrl)
      const level = validateLevel(raw)
      const assets = listLevelAssetUrls(webPlatform.content, level)
      const cached = assets.every((asset) => webPlatform.cache.get(this.cacheKey(asset)))
      if (!cached) this.loadingText.setText('关卡加载中 10%').setVisible(true)
      else this.loadingText.setVisible(false)
      const sources = assets.map((asset) => ({
        ...asset,
        src: webPlatform.cache.get(this.cacheKey(asset)) ?? asset.url,
      }))
      let done = 0
      await runPool(sources, 8, async (asset) => {
        this.textureKeys.push(asset.key)
        await addTexture(this, asset.key, asset.src)
        done += 1
        if (!cached) {
          this.loadingText.setText(`关卡加载中 ${Math.round(loadingFraction(true, done, sources.length) * 100)}%`)
        }
      })
      if (!this.scene.isActive()) return
      for (const asset of sources) webPlatform.cache.put(this.cacheKey(asset), asset.src)
      this.beginPlay(level)
    } catch {
      if (this.scene.isActive()) this.showLoadError()
    }
  }

  private beginPlay(level: LevelFile) {
    this.level = level
    this.session = new LevelSession(level)
    if (this.backgrounded) this.session.pause()
    this.loadingText.setVisible(false)
    const picture = level.level.picture
    const scale = Math.min(694 / picture.width, 500 / picture.height)
    const width = picture.width * scale
    const height = picture.height * scale
    const x = (750 - width) / 2
    const topY = 156
    const bottomY = topY + height + 44
    this.layout = { x, topY, bottomY, width, height, scale }
    this.add.image(x, topY, level.pictures.top.key).setOrigin(0, 0).setDisplaySize(width, height).setDepth(1)
    this.add.image(x, bottomY, level.pictures.bottom.key).setOrigin(0, 0).setDisplaySize(width, height).setDepth(1)
    this.refreshHud()
    this.paintDots()
  }

  private onPointer(pointer: Phaser.Input.Pointer) {
    if (!this.session || !this.level || !this.layout || this.session.phase !== 'play') return
    const local = this.toPicture(pointer.x, pointer.y)
    if (!local) return
    const spot = differenceAt(this.level.items, local.x, local.y)
    const result = this.session.tap(spot?.itemId ?? null)
    if (result.type === 'empty') this.onEmpty()
    if (result.type === 'found') this.afterFound(result)
  }

  private onEmpty() {
    if (this.resourceId !== '001' || this.missedOnce) return
    this.missedOnce = true
    this.tipText.setText('点出两张图不一样的地方')
    this.time.delayedCall(1200, () => {
      if (this.tipText.text === '点出两张图不一样的地方') this.tipText.setText('')
    })
  }

  private afterFound(result: Extract<PlayResult, { type: 'found' }>) {
    if (!this.session || !this.level) return
    const item = this.level.items.find((entry) => entry.itemId === result.itemId)
    if (!item) return
    this.strokeBoth(item, 0xf6e27a, 6, this.marks)
    this.paintDots()
    this.tipText.setText(result.displayName)
    this.time.delayedCall(800, () => {
      if (this.tipText.text === result.displayName) this.tipText.setText('')
    })
    if (this.session.phase === 'won' && !this.saved && this.level) {
      this.saved = true
      webPlatform.saveProgress(markCleared(webPlatform.loadProgress(), this.level.level.resourceId))
    }
    this.refreshHud()
    this.maybeFinish()
  }

  private useHint() {
    const hint = this.session?.hint()
    if (!hint) return
    this.tipText.setText(hint.tip)
    this.hintMark.clear()
    this.strokeBoth(hint, 0xf6e27a, 4, this.hintMark)
  }

  private strokeBoth(item: Pick<DiffItem, 'x' | 'y' | 'radius'>, color: number, width: number, graphics: Phaser.GameObjects.Graphics) {
    if (!this.layout) return
    graphics.lineStyle(width, color, 1)
    for (const originY of [this.layout.topY, this.layout.bottomY]) {
      graphics.strokeCircle(
        this.layout.x + item.x * this.layout.scale,
        originY + item.y * this.layout.scale,
        item.radius * this.layout.scale,
      )
    }
  }

  private paintDots() {
    if (!this.level || !this.session || !this.layout) return
    this.dots.clear()
    const items = [...this.level.items].sort((a, b) => a.order - b.order)
    const gap = 28
    let x = 375 - ((items.length - 1) * gap) / 2
    const y = this.layout.topY + this.layout.height + 22
    for (const item of items) {
      this.dots.fillStyle(this.session.found.has(item.itemId) ? 0xf6e27a : 0x3a342c, 1)
      this.dots.fillCircle(x, y, 8)
      x += gap
    }
  }

  private toPicture(x: number, y: number) {
    if (!this.layout || !this.level) return null
    const { x: left, width, height, scale, topY, bottomY } = this.layout
    const inTop = x >= left && x <= left + width && y >= topY && y <= topY + height
    const inBottom = x >= left && x <= left + width && y >= bottomY && y <= bottomY + height
    if (!inTop && !inBottom) return null
    const originY = inTop ? topY : bottomY
    return { x: (x - left) / scale, y: (y - originY) / scale }
  }

  private refreshHud() {
    if (!this.level || !this.session) return
    this.titleText.setText(this.level.level.title)
    this.countText.setText(`已找到 ${this.session.found.size}/${this.level.level.targetCount}`)
    this.timeText.setText(`${Math.ceil(this.session.remainingMs / 1000)}s`)
  }

  private maybeFinish() {
    if (!this.session || this.resultShown) return
    if (this.session.phase !== 'won' && this.session.phase !== 'lost') return
    this.resultShown = true
    const index = this.catalog.levels.findIndex((level) => level.resourceId === this.resourceId)
    const next = this.catalog.levels[index + 1]
    this.scene.launch('Result', {
      won: this.session.phase === 'won',
      hasNext: this.session.phase === 'won' && Boolean(next),
      nextResourceId: next?.resourceId,
      catalog: this.catalog,
    })
  }

  private showLoadError() {
    this.loadingText.setText('关卡加载失败').setVisible(true)
    addButton(this, 250, 800, 200, 88, '重试', () => {
      this.scene.restart({ resourceId: this.resourceId, catalog: this.catalog })
    }, 410)
    addButton(this, 500, 800, 200, 88, '返回', () => this.scene.start('Home'), 410)
  }

  private cacheKey(asset: LevelAssetUrl) {
    return levelCacheKey(this.resourceId, asset)
  }
}

async function addTexture(scene: Phaser.Scene, key: string, url: string) {
  if (scene.textures.exists(key)) scene.textures.remove(key)
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(key))
    image.src = url
  })
  if (!scene.sys.isActive()) return
  scene.textures.addImage(key, image)
}

async function runPool<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const current = items[cursor]
      cursor += 1
      if (current) await task(current)
    }
  })
  await Promise.all(workers)
}

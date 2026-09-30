import Phaser from 'phaser'
import { levelCacheKey, levelJsonUrl, listLevelAssetUrls, loadingFraction } from '../levels/assets'
import { LevelSession, type PlayResult } from '../levels/session'
import { validateLevel } from '../levels/validate'
import type { Catalog, LevelAssetUrl, LevelFile, SceneNode } from '../levels/types'
import { markCleared } from '../platform/types'
import { webPlatform } from '../platform/web'
import { addButton } from './button'

interface LevelStart {
  resourceId: string
  catalog: Catalog
}

export class LevelScene extends Phaser.Scene {
  private resourceId = ''
  private catalog: Catalog = { schemaVersion: 'spot-catalog-v1', levels: [] }
  private level: LevelFile | null = null
  private session: LevelSession | null = null
  private images = new Map<string, Phaser.GameObjects.Image>()
  private zones = new Map<string, Phaser.GameObjects.Zone>()
  private textureKeys: string[] = []
  private titleText!: Phaser.GameObjects.Text
  private countText!: Phaser.GameObjects.Text
  private timeText!: Phaser.GameObjects.Text
  private tipText!: Phaser.GameObjects.Text
  private dialogue!: Phaser.GameObjects.Text
  private hintMark!: Phaser.GameObjects.Graphics
  private loadingText!: Phaser.GameObjects.Text
  private bigShade!: Phaser.GameObjects.Rectangle
  private closeButton!: Phaser.GameObjects.Rectangle
  private closeLabel!: Phaser.GameObjects.Text
  private slots: Phaser.GameObjects.Rectangle[] = []
  private flyPool: Phaser.GameObjects.Image[] = []
  private flashPool: Phaser.GameObjects.Arc[] = []
  private poolCursor = 0
  private releaseOnThisFrame = false
  private resultShown = false
  private missedOnce = false
  private saved = false
  private backgrounded = false
  private bigTimer: Phaser.Time.TimerEvent | null = null
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
    this.images.clear()
    this.zones.clear()
    this.textureKeys = []
    this.slots = []
    this.releaseOnThisFrame = false
    this.resultShown = false
    this.missedOnce = false
    this.saved = false
    this.session = null
    this.level = null
    this.add.rectangle(375, 80, 750, 160, 0x1a1714)
    this.titleText = this.add.text(40, 36, '', { fontFamily: 'sans-serif', fontSize: '36px', color: '#f4f1ea' }).setDepth(300)
    this.countText = this.add.text(40, 90, '', { fontFamily: 'sans-serif', fontSize: '28px', color: '#f4f1ea' }).setDepth(300)
    this.timeText = this.add.text(560, 48, '', { fontFamily: 'sans-serif', fontSize: '36px', color: '#f4f1ea' }).setDepth(300)
    this.tipText = this.add.text(375, 180, '', { fontFamily: 'sans-serif', fontSize: '28px', color: '#f6e27a' }).setOrigin(0.5).setDepth(300)
    this.dialogue = this.add
      .text(375, 520, '', { fontFamily: 'sans-serif', fontSize: '32px', color: '#f4f1ea', align: 'center', wordWrap: { width: 620 } })
      .setOrigin(0.5)
      .setDepth(280)
      .setVisible(false)
    this.hintMark = this.add.graphics().setDepth(40)
    this.bigShade = this.add.rectangle(375, 667, 750, 1334, 0x000000, 0.55).setDepth(70).setVisible(false)
    this.bigShade.setInteractive()
    this.closeButton = this.add.rectangle(640, 180, 88, 88, 0x3d6b4f).setDepth(90).setVisible(false).setInteractive()
    this.closeLabel = this.add
      .text(640, 180, '关闭', { fontFamily: 'sans-serif', fontSize: '28px', color: '#f4f1ea' })
      .setOrigin(0.5)
      .setDepth(91)
      .setVisible(false)
    this.closeButton.on('pointerdown', () => this.closeBig())
    this.loadingText = this.add
      .text(375, 667, '关卡加载中', { fontFamily: 'sans-serif', fontSize: '36px', color: '#f4f1ea' })
      .setOrigin(0.5)
      .setDepth(400)
    addButton(this, 90, 1248, 120, 88, '提示', () => this.useHint(), 300)
    this.removeHide = webPlatform.onHide(() => {
      this.backgrounded = true
      this.session?.pause()
    })
    this.removeShow = webPlatform.onShow(() => {
      this.backgrounded = false
      if (this.session?.phase === 'bigImage') this.closeBig()
      this.session?.resume()
    })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.session || this.session.phase !== 'play' || this.session.inputLocked) return
      if (pointer.y < 200 || pointer.y > 1080) return
      const hit = this.input.hitTestPointer(pointer).some((object) => this.zones.has(object.name))
      if (!hit) this.onEmpty()
    })
    void this.loadLevel()
  }

  update(_time: number, delta: number) {
    if (!this.session || this.resultShown) return
    if (this.releaseOnThisFrame) {
      this.session.releaseInputLock()
      this.releaseOnThisFrame = false
    }
    this.session.tick(delta)
    if (this.session.unlockArmed) this.releaseOnThisFrame = true
    this.refreshHud()
    this.maybeFinish()
  }

  retry() {
    if (!this.level) return
    this.scene.stop('Result')
    this.bigTimer?.remove()
    this.session = new LevelSession(this.level)
    if (this.backgrounded) this.session.pause()
    this.resultShown = false
    this.missedOnce = false
    this.saved = false
    this.releaseOnThisFrame = false
    this.hideBigChrome()
    this.applyVisibility()
    this.hintMark.clear()
    this.tipText.setText('')
    this.dialogue.setVisible(false)
    this.refreshHud()
    this.paintSlots()
  }

  shutdown() {
    this.bigTimer?.remove()
    this.load.reset()
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
      const cached = assets.length > 0 && assets.every((asset) => webPlatform.cache.get(this.cacheKey(asset)))
      if (!cached) this.loadingText.setText('关卡加载中 10%').setVisible(true)
      else this.loadingText.setVisible(false)
      const sources = assets.map((asset) => ({
        ...asset,
        src: webPlatform.cache.get(this.cacheKey(asset)) ?? asset.url,
      }))
      if (sources.length === 0) {
        this.beginPlay(level)
        return
      }
      let done = 0
      await runPool(sources, 8, async (asset) => {
        this.textureKeys.push(asset.key)
        if (asset.kind === 'image') await addTexture(this, asset.key, asset.src)
        else await assertReachable(asset.src, asset.key)
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
    this.flyPool = []
    this.flashPool = []
    for (let index = 0; index < 8; index += 1) {
      this.flyPool.push(this.add.image(0, 0, level.layout.background.key).setVisible(false).setDepth(320))
      this.flashPool.push(this.add.circle(0, 0, 18, 0xf6e27a, 0.8).setVisible(false).setDepth(310))
    }
    if (this.textures.exists(level.layout.background.key)) {
      this.add.image(375, 667, level.layout.background.key).setDepth(0)
    }
    for (const node of level.layout.nodes) this.addNode(node)
    this.buildSlots(level)
    this.refreshHud()
  }

  private addNode(node: SceneNode) {
    if (node.imageKey && this.textures.exists(node.imageKey)) {
      const image = this.add.image(node.x, node.y, node.imageKey).setDepth(node.depth)
      image.setVisible(this.session?.visibleNodes.has(node.name) ?? node.visible)
      this.images.set(node.name, image)
    }
    if (!node.hit || node.hit.kind === 'polygon') return
    const zone = hitZone(this, node)
    if (!zone) return
    zone.name = node.name
    zone.setDepth(node.depth + 1)
    zone.on('pointerdown', () => this.onNode(node.name))
    this.zones.set(node.name, zone)
  }

  private onNode(name: string) {
    if (!this.session) return
    const result = this.session.tap(name)
    if (result.type === 'openBig') {
      this.showBig(result.nodeName, result.autoDismissSec)
      return
    }
    if (result.type === 'empty') return
    this.afterPlay(result)
  }

  private onEmpty() {
    if (this.resourceId !== '001' || this.missedOnce) return
    this.missedOnce = true
    this.showDialogue('点出不对劲的地方')
  }

  private afterPlay(result: PlayResult) {
    if (!this.session) return
    if (result.type === 'collected' || result.type === 'changed') {
      this.applyVisibility()
      this.hideBigChrome()
      this.paintSlots()
      this.showDialogue(result.dialogueText)
      const item = this.level?.items.find((entry) => entry.itemId === result.itemId)
      const node = item ? this.level?.layout.nodes.find((entry) => entry.name === item.logic.nodes.collect) : undefined
      if (item && node) {
        this.fly(item.assets.collectImage?.key, node.x, node.y, item.order)
        this.flash(node.x, node.y)
      }
      if (this.session.phase === 'won' && !this.saved && this.level) {
        this.saved = true
        webPlatform.saveProgress(markCleared(webPlatform.loadProgress(), this.level.level.resourceId))
      }
    }
    this.refreshHud()
    this.maybeFinish()
  }

  private showBig(nodeName: string, seconds: number) {
    this.applyVisibility()
    this.bigShade.setVisible(true)
    this.closeButton.setVisible(true)
    this.closeLabel.setVisible(true)
    this.bigTimer?.remove()
    this.bigTimer = this.time.delayedCall(seconds * 1000, () => this.closeBig())
    this.images.get(nodeName)?.setDepth(80)
  }

  private closeBig() {
    if (!this.session || this.session.phase !== 'bigImage') return
    this.bigTimer?.remove()
    const result = this.session.dismissBigImage()
    this.afterPlay(result)
  }

  private hideBigChrome() {
    this.bigShade.setVisible(false)
    this.closeButton.setVisible(false)
    this.closeLabel.setVisible(false)
  }

  private useHint() {
    const hint = this.session?.hint()
    if (!hint || !this.level) return
    const node = this.level.layout.nodes.find((entry) => entry.name === hint.nodeName)
    this.tipText.setText(hint.tip)
    this.hintMark.clear()
    if (!node?.hit) return
    this.hintMark.lineStyle(6, 0xf6e27a, 1)
    if (node.hit.kind === 'rect') {
      this.hintMark.strokeRect(node.hit.x, node.hit.y, node.hit.width, node.hit.height)
    } else if (node.hit.kind === 'circle') {
      this.hintMark.strokeCircle(node.hit.x, node.hit.y, node.hit.radius)
    }
  }

  private applyVisibility() {
    if (!this.session) return
    for (const [name, image] of this.images) image.setVisible(this.session.visibleNodes.has(name))
  }

  private buildSlots(level: LevelFile) {
    const items = level.items.filter((item) => item.needCollect !== false).sort((a, b) => a.order - b.order)
    const width = 140
    const gap = 16
    const total = items.length * width + (items.length - 1) * gap
    let x = (750 - total) / 2 + width / 2
    for (const item of items) {
      const slot = this.add.rectangle(x, 1140, width, 120, 0x2a241e).setDepth(300)
      this.add
        .text(x, 1188, item.collectText, { fontFamily: 'sans-serif', fontSize: '22px', color: '#f4f1ea' })
        .setOrigin(0.5)
        .setDepth(301)
      this.slots[item.order] = slot
      x += width + gap
    }
  }

  private paintSlots() {
    if (!this.session || !this.level) return
    for (const item of this.level.items) {
      const slot = this.slots[item.order]
      if (!slot) continue
      slot.setFillStyle(this.session.found.has(item.itemId) ? 0x3d6b4f : 0x2a241e)
    }
  }

  private fly(texture: string | undefined, fromX: number, fromY: number, order: number) {
    const slot = this.slots[order]
    const icon = this.flyPool[this.poolCursor % Math.max(this.flyPool.length, 1)]
    this.poolCursor += 1
    if (!texture || !slot || !icon || !this.textures.exists(texture)) return
    icon.setTexture(texture).setVisible(true).setPosition(fromX, fromY).setDisplaySize(72, 72)
    this.tweens.add({
      targets: icon,
      x: slot.x,
      y: slot.y - 16,
      duration: 280,
      ease: 'Power2',
      onComplete: () => icon.setVisible(false),
    })
  }

  private flash(x: number, y: number) {
    const mark = this.flashPool[this.poolCursor % Math.max(this.flashPool.length, 1)]
    if (!mark) return
    mark.setPosition(x, y).setVisible(true).setScale(1)
    this.tweens.add({
      targets: mark,
      scale: 2.2,
      alpha: 0,
      duration: 220,
      onComplete: () => {
        mark.setVisible(false)
        mark.setAlpha(0.8)
      },
    })
  }

  private showDialogue(text: string) {
    this.dialogue.setText(text).setVisible(true)
    this.time.delayedCall(1200, () => {
      if (this.dialogue.text === text) this.dialogue.setVisible(false)
    })
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
    addButton(this, 500, 800, 200, 88, '返回', () => {
      this.scene.start('Home')
    }, 410)
  }

  private cacheKey(asset: LevelAssetUrl) {
    return levelCacheKey(this.resourceId, asset)
  }
}

async function assertReachable(url: string, key: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(key)
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

function hitZone(scene: Phaser.Scene, node: SceneNode) {
  const hit = node.hit
  if (!hit || hit.kind === 'polygon') return null
  if (hit.kind === 'rect') {
    const zone = scene.add.zone(hit.x + hit.width / 2, hit.y + hit.height / 2, hit.width, hit.height)
    zone.setInteractive(new Phaser.Geom.Rectangle(0, 0, hit.width, hit.height), Phaser.Geom.Rectangle.Contains)
    return zone
  }
  const zone = scene.add.zone(hit.x, hit.y, hit.radius * 2, hit.radius * 2)
  zone.setInteractive(new Phaser.Geom.Circle(hit.radius, hit.radius, hit.radius), Phaser.Geom.Circle.Contains)
  return zone
}

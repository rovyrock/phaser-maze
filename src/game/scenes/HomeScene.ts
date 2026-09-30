import Phaser from 'phaser'
import { continueTarget, isUnlocked, parseCatalog } from '../levels/catalog'
import type { Catalog } from '../levels/types'
import { webPlatform } from '../platform/web'
import { addButton } from './button'

export class HomeScene extends Phaser.Scene {
  private listDrag = { tracking: false, moved: false, startY: 0, originY: 0 }
  private unbindList: (() => void) | null = null

  constructor() {
    super('Home')
  }

  create() {
    this.add
      .text(375, 160, '找茬', { fontFamily: 'sans-serif', fontSize: '72px', color: '#f4f1ea' })
      .setOrigin(0.5)
    void this.loadCatalog()
  }

  private async loadCatalog() {
    this.children.removeAll()
    this.add
      .text(375, 160, '找茬', { fontFamily: 'sans-serif', fontSize: '72px', color: '#f4f1ea' })
      .setOrigin(0.5)
    const status = this.add
      .text(375, 280, '目录加载中', { fontFamily: 'sans-serif', fontSize: '32px', color: '#f4f1ea' })
      .setOrigin(0.5)
    try {
      const raw = await webPlatform.loadLevelFile(webPlatform.content.catalogUrl)
      const catalog = parseCatalog(raw)
      status.destroy()
      this.renderCatalog(catalog)
    } catch {
      status.setText('目录加载失败')
      addButton(this, 375, 420, 240, 88, '重试', () => {
        void this.loadCatalog()
      })
    }
  }

  private renderCatalog(catalog: Catalog) {
    this.unbindList?.()
    this.unbindList = null
    const progress = webPlatform.loadProgress()
    const next = continueTarget(catalog.levels, progress.cleared)
    if (next) {
      addButton(this, 375, 300, 280, 88, '继续', () => {
        this.scene.start('Level', { resourceId: next, catalog })
      })
    }
    const list = this.add.container(0, 0)
    catalog.levels.forEach((level, index) => {
      const open = isUnlocked(catalog.levels, level.resourceId, progress.cleared)
      const y = 460 + index * 120
      const cleared = progress.cleared.includes(level.resourceId)
      const label = open ? `${level.title}${cleared ? ' · 已通过' : ''}` : `${level.title} · 未解锁`
      const control = addButton(this, 375, y, 460, 88, label, () => {})
      control.button.off('pointerdown')
      control.button.on('pointerup', () => {
        if (this.listDrag.moved || !open) return
        this.scene.start('Level', { resourceId: level.resourceId, catalog })
      })
      if (!open) control.button.setFillStyle(0x3a342c)
      list.add([control.button, control.text])
    })
    const lastY = 460 + (catalog.levels.length - 1) * 120
    const overflow = lastY + 44 - 1260
    if (overflow <= 0) return
    const minY = -overflow
    const onDown = (pointer: Phaser.Input.Pointer) => {
      this.listDrag.tracking = true
      this.listDrag.moved = false
      this.listDrag.startY = pointer.y
      this.listDrag.originY = list.y
    }
    const onMove = (pointer: Phaser.Input.Pointer) => {
      if (!this.listDrag.tracking) return
      const dy = pointer.y - this.listDrag.startY
      if (Math.abs(dy) > 12) this.listDrag.moved = true
      if (!this.listDrag.moved) return
      list.y = Phaser.Math.Clamp(this.listDrag.originY + dy, minY, 0)
    }
    const onUp = () => {
      this.listDrag.tracking = false
    }
    this.input.on('pointerdown', onDown)
    this.input.on('pointermove', onMove)
    this.input.on('pointerup', onUp)
    this.unbindList = () => {
      this.input.off('pointerdown', onDown)
      this.input.off('pointermove', onMove)
      this.input.off('pointerup', onUp)
    }
  }
}

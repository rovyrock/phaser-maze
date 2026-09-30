import Phaser from 'phaser'
import { continueTarget, isUnlocked, parseCatalog } from '../levels/catalog'
import type { Catalog } from '../levels/types'
import { webPlatform } from '../platform/web'
import { addButton } from './button'

export class HomeScene extends Phaser.Scene {
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
    const progress = webPlatform.loadProgress()
    const next = continueTarget(catalog.levels, progress.cleared)
    if (next) {
      addButton(this, 375, 300, 280, 88, '继续', () => {
        this.scene.start('Level', { resourceId: next, catalog })
      })
    }
    catalog.levels.forEach((level, index) => {
      const open = isUnlocked(catalog.levels, level.resourceId, progress.cleared)
      const y = 460 + index * 120
      const cleared = progress.cleared.includes(level.resourceId)
      const label = open ? `${level.title}${cleared ? ' · 已通过' : ''}` : `${level.title} · 未解锁`
      const control = addButton(this, 375, y, 460, 88, label, () => {
        if (!open) return
        this.scene.start('Level', { resourceId: level.resourceId, catalog })
      })
      if (!open) control.button.setFillStyle(0x3a342c)
    })
  }
}

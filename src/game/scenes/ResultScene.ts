import Phaser from 'phaser'
import type { Catalog } from '../levels/types'
import { addButton } from './button'
import type { LevelScene } from './LevelScene'

interface ResultData {
  won: boolean
  hasNext: boolean
  nextResourceId?: string
  catalog: Catalog
}

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('Result')
  }

  create(data: ResultData) {
    this.add.rectangle(375, 667, 750, 1334, 0x000000, 0.72)
    this.add
      .text(375, 460, data.won ? '找齐了' : '时间到', {
        fontFamily: 'sans-serif',
        fontSize: '64px',
        color: '#f4f1ea',
      })
      .setOrigin(0.5)
    if (data.won && data.hasNext && data.nextResourceId) {
      addButton(this, 375, 680, 320, 88, '下一关', () => {
        this.scene.start('Level', { resourceId: data.nextResourceId, catalog: data.catalog })
      })
      addButton(this, 375, 820, 320, 88, '返回', () => this.goHome())
      return
    }
    if (data.won) {
      addButton(this, 375, 680, 320, 88, '返回首页', () => this.goHome())
      addButton(this, 375, 820, 320, 88, '返回', () => this.goHome())
      return
    }
    addButton(this, 375, 680, 320, 88, '重试', () => {
      const level = this.scene.get('Level') as LevelScene
      level.retry()
    })
    addButton(this, 375, 820, 320, 88, '返回', () => this.goHome())
  }

  private goHome() {
    this.scene.stop('Level')
    this.scene.start('Home')
  }
}

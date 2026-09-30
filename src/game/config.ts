import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { HomeScene } from './scenes/HomeScene'
import { LevelScene } from './scenes/LevelScene'
import { ResultScene } from './scenes/ResultScene'

export const GAME_WIDTH = 750
export const GAME_HEIGHT = 1334

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  title: '找茬',
  version: '0.0.0',
  backgroundColor: '#1a1714',
  disableContextMenu: true,
  scale: {
    parent: 'game-container',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: [BootScene, HomeScene, LevelScene, ResultScene],
}

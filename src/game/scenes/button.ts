import Phaser from 'phaser'

export function addButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  depth = 0,
) {
  const button = scene.add
    .rectangle(x, y, width, height, 0x3d6b4f)
    .setInteractive({ useHandCursor: true })
    .setDepth(depth)
  const text = scene.add
    .text(x, y, label, { fontFamily: 'sans-serif', fontSize: '32px', color: '#f4f1ea' })
    .setOrigin(0.5)
    .setDepth(depth + 1)
  button.on('pointerdown', () => onClick())
  return { button, text }
}

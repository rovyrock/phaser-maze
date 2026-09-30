import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const root = process.cwd()
const specDir = path.resolve(root, process.argv[2] ?? 'content/specs')
const files = fs.readdirSync(specDir).filter((name) => name.endsWith('.json')).sort()
if (files.length === 0) {
  console.log('没有规格，跳过生成')
  process.exit(0)
}

for (const file of files) {
  const spec = JSON.parse(fs.readFileSync(path.join(specDir, file), 'utf8'))
  const built = buildLevel(spec)
  const dir = path.join(root, 'content/levels', built.level.level.resourceId)
  fs.mkdirSync(path.join(dir, 'assets/images'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'assets/images/top.png'), built.top)
  fs.writeFileSync(path.join(dir, 'assets/images/bottom.png'), built.bottom)
  fs.writeFileSync(path.join(dir, 'level.json'), `${JSON.stringify(built.level, null, 2)}\n`)
  console.log(`${built.level.level.resourceId} ${built.level.level.title} ${built.level.items.length} 处`)
}

function buildLevel(spec) {
  if (spec.schemaVersion !== 'diff-spec-v1') throw new Error('schemaVersion 必须是 diff-spec-v1')
  const width = spec.picture.width
  const height = spec.picture.height
  const top = draw(width, height, spec.shapes)
  const bottomShapes = applyOps(spec.shapes, spec.differences)
  const bottom = draw(width, height, bottomShapes)
  for (const diff of spec.differences) {
    const x = Math.round(diff.x)
    const y = Math.round(diff.y)
    if (!pixelDiffers(top, bottom, width, x, y)) {
      throw new Error(`${diff.itemId} 圆心 (${x},${y}) 上下像素相同`)
    }
  }
  const level = {
    schemaVersion: 'diff-level-phaser-v1',
    gameCode: spec.gameCode,
    level: {
      resourceId: spec.level.resourceId,
      configId: spec.level.configId,
      title: spec.level.title,
      description: spec.level.description,
      type: 'diff',
      targetCount: spec.differences.length,
      totalTime: spec.level.totalTime,
      picture: { width, height },
    },
    pictures: {
      top: { slot: 'top', path: 'assets/images/top.png', key: 'top' },
      bottom: { slot: 'bottom', path: 'assets/images/bottom.png', key: 'bottom' },
    },
    items: spec.differences.map((diff) => ({
      itemId: diff.itemId,
      order: diff.order,
      slug: diff.slug,
      displayName: diff.displayName,
      tip: diff.tip,
      x: diff.x,
      y: diff.y,
      radius: diff.radius,
    })),
  }
  return { level, top: encodePng(width, height, top), bottom: encodePng(width, height, bottom) }
}

function applyOps(shapes, differences) {
  const next = shapes.map((shape) => structuredClone(shape))
  for (const diff of differences) {
    const op = diff.op
    if (op.kind === 'recolor') {
      const shape = next.find((entry) => entry.id === op.shapeId)
      if (!shape) throw new Error(`${diff.itemId} 找不到 ${op.shapeId}`)
      shape.fill = op.fill
    } else if (op.kind === 'hide') {
      const index = next.findIndex((entry) => entry.id === op.shapeId)
      if (index < 0) throw new Error(`${diff.itemId} 找不到 ${op.shapeId}`)
      next.splice(index, 1)
    } else if (op.kind === 'move') {
      const shape = next.find((entry) => entry.id === op.shapeId)
      if (!shape) throw new Error(`${diff.itemId} 找不到 ${op.shapeId}`)
      shift(shape, op.dx ?? 0, op.dy ?? 0)
    } else if (op.kind === 'add') {
      next.push(structuredClone(op.shape))
    } else {
      throw new Error(`${diff.itemId} 不认识的操作 ${op.kind}`)
    }
  }
  return next
}

function shift(shape, dx, dy) {
  if (typeof shape.x === 'number') shape.x += dx
  if (typeof shape.y === 'number') shape.y += dy
  if (Array.isArray(shape.points)) {
    shape.points = shape.points.map(([x, y]) => [x + dx, y + dy])
  }
}

function draw(width, height, shapes) {
  const data = new Uint8Array(width * height * 4)
  for (const shape of shapes) paint(data, width, height, shape)
  return data
}

function paint(data, width, height, shape) {
  const color = parseColor(shape.fill)
  if (shape.kind === 'rect') fillRect(data, width, height, shape.x, shape.y, shape.w, shape.h, color)
  else if (shape.kind === 'circle') fillCircle(data, width, height, shape.x, shape.y, shape.r, color)
  else if (shape.kind === 'ellipse') fillEllipse(data, width, height, shape.x, shape.y, shape.rx, shape.ry, color)
  else if (shape.kind === 'tri') fillTriangle(data, width, height, shape.points, color)
  else throw new Error(`不认识的形状 ${shape.kind}`)
}

function fillRect(data, width, height, x, y, w, h, color) {
  const x0 = Math.max(0, Math.floor(x))
  const y0 = Math.max(0, Math.floor(y))
  const x1 = Math.min(width, Math.ceil(x + w))
  const y1 = Math.min(height, Math.ceil(y + h))
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) setPixel(data, width, px, py, color)
  }
}

function fillCircle(data, width, height, cx, cy, r, color) {
  const r2 = r * r
  const x0 = Math.max(0, Math.floor(cx - r))
  const y0 = Math.max(0, Math.floor(cy - r))
  const x1 = Math.min(width, Math.ceil(cx + r))
  const y1 = Math.min(height, Math.ceil(cy + r))
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const dx = px + 0.5 - cx
      const dy = py + 0.5 - cy
      if (dx * dx + dy * dy <= r2) setPixel(data, width, px, py, color)
    }
  }
}

function fillEllipse(data, width, height, cx, cy, rx, ry, color) {
  const x0 = Math.max(0, Math.floor(cx - rx))
  const y0 = Math.max(0, Math.floor(cy - ry))
  const x1 = Math.min(width, Math.ceil(cx + rx))
  const y1 = Math.min(height, Math.ceil(cy + ry))
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const dx = (px + 0.5 - cx) / rx
      const dy = (py + 0.5 - cy) / ry
      if (dx * dx + dy * dy <= 1) setPixel(data, width, px, py, color)
    }
  }
}

function fillTriangle(data, width, height, points, color) {
  const [a, b, c] = points
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])))
  const maxX = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0])))
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])))
  const maxY = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])))
  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      if (insideTriangle(px + 0.5, py + 0.5, a, b, c)) setPixel(data, width, px, py, color)
    }
  }
}

function insideTriangle(px, py, a, b, c) {
  const d1 = sign(px, py, a, b)
  const d2 = sign(px, py, b, c)
  const d3 = sign(px, py, c, a)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}

function sign(px, py, a, b) {
  return (px - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (py - b[1])
}

function setPixel(data, width, x, y, color) {
  const index = (y * width + x) * 4
  data[index] = color[0]
  data[index + 1] = color[1]
  data[index + 2] = color[2]
  data[index + 3] = 255
}

function pixelDiffers(top, bottom, width, x, y) {
  const index = (y * width + x) * 4
  return top[index] !== bottom[index] || top[index + 1] !== bottom[index + 1] || top[index + 2] !== bottom[index + 2]
}

function parseColor(hex) {
  const value = hex.replace('#', '')
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)]
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1)
    raw[row] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, row + 1)
  }
  const compressed = zlib.deflateSync(raw)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr(width, height)),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function ihdr(width, height) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return header
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([length, typeBuf, data, crc])
}

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

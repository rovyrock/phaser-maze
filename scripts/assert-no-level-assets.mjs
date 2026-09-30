import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const dist = path.resolve('dist')
const hits = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name)
    if (statSync(file).isDirectory()) {
      walk(file)
      continue
    }
    const rel = file.replaceAll('\\', '/')
    if (rel.includes('/content/') || rel.includes('levels/001')) hits.push(rel)
  }
}

walk(dist)
if (hits.length > 0) {
  console.error(hits.join('\n'))
  throw new Error('构建产物里出现了关卡资源')
}

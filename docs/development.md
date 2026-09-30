# 找茬开发文档

玩家规则见 `docs/requirements.md`。本文定模块、关卡数据和实现顺序。先改文档，再写代码。

## 结论

用 Phaser 4 画上下两张图和界面。找不同判定、倒计时和胜负写成不引用 Phaser 的 TypeScript，用 Vitest 测。浏览器用 Vite 跑。微信小游戏等核心循环可玩后再接，平台差异收进 `platform`。

Phaser 官方 skill 随 `phaser` 包发布，路径是 `node_modules/phaser/skills/`。实现时按 `.cursor/rules/engine-and-platform.mdc` 读取。微信侧读 `.cursor/skills/wechat-minigame-dev/`。该技能的引擎表没有 Phaser。渲染继续用 Phaser。`wx.*`、包体、分享和广告按该技能执行。

这一版不是单张场景收集，也不是 Cocos 那套逻辑模板。iWiki [4022524132](https://iwiki.woa.com/p/4022524132)、[4022261994](https://iwiki.woa.com/p/4022261994)、[4043585002](https://iwiki.woa.com/p/4043585002) 只作背景：前者是另一套茬点协议，中者是制作工具，后者是合集大厅。第一版都不接入。

## 关卡数据

可玩文件在 `content/levels/{resourceId}/`，和游戏包分开。`content/` 只给本地内容服务和以后上传，Vite 构建和微信上传包都不包含这个目录。

schema 是 `diff-level-phaser-v1`。不同处坐标在图片像素里，不是 750×1334 设计坐标。上图和下图共用这一套坐标，原点在图片左上角，y 向下。

```ts
interface LevelFile {
  schemaVersion: 'diff-level-phaser-v1'
  gameCode: string
  level: {
    resourceId: string
    configId: number
    title: string
    description: string
    type: 'diff'
    targetCount: number
    totalTime: number
    picture: { width: number; height: number }
  }
  pictures: { top: AssetRef; bottom: AssetRef }
  items: DiffItem[]
}

interface DiffItem {
  itemId: string
  order: number
  slug: string
  displayName: string
  tip: string
  x: number
  y: number
  radius: number
}
```

`itemId` 稳定。`slug` 匹配 `^[A-Za-z0-9]+([_-][A-Za-z0-9]+)*$`，单词之间可以用连字符或下划线。`order` 从 1 开始。`targetCount` 必须等于 `items` 长度。`x`、`y` 落在图片范围内，`radius` 为正数。

`level.json` 用 `loadLevelFile` 拉取。两张图用拼好的绝对 URL，键用 `AssetRef.key`。浏览器不用 Phaser Loader 队列：同一场景重开后，这条队列会停在半截进度。图片用 `Image` 解码后交给 `textures.addImage`。禁止用打包器的 `import` 把关卡图打进 JS。

校验失败就拒绝进关。错误信息带上 `itemId`（如果已经知道是哪一条）：

- `schemaVersion` 必须是 `diff-level-phaser-v1`
- `resourceId` 匹配 `^[0-9]{3}$`，`configId` 为正整数
- `type` 只接受 `diff`
- `itemId`、`slug`、`order` 各自唯一
- `pictures.top` 和 `pictures.bottom` 的 `path` 以 `assets/` 开头，且不含 `..`
- 两个 `key` 不相同

样例 `docs/samples/level-001.json` 是第 1 关「山羊草地」的外部包配置，测试用它做校验。图片是 `assets/images/top.jpg` 和 `assets/images/bottom.jpg`。

## 生成茬图

手改两张图和圆心容易对不齐。规格是唯一作者入口，脚本同时画出两张图和 `level.json`。

规格放在 `content/specs/{resourceId}.json`，schema 是 `diff-spec-v1`。`shapes` 是两张图共用的矩形、圆、椭圆和三角形。`differences[].op` 只作用在下图：

| op.kind | 作用 |
| --- | --- |
| `recolor` | 下图里该形状换色 |
| `hide` | 下图不画该形状 |
| `move` | 下图里该形状平移 `dx`、`dy` |
| `add` | 只在下图多画一个形状 |

每个不同处自己写 `x`、`y`、`radius`、`displayName`、`tip`。脚本画完后检查圆心像素：上图和下图在这个点上必须不同，否则生成失败。

```text
npm run levels
```

这会读取 `content/specs/`，写入 `content/levels/{resourceId}/level.json`、`assets/images/top.png`、`assets/images/bottom.png`。目录 `content/catalog.json` 仍手写名单，脚本不改解锁顺序，也不改 `docs/samples/`。

001 到 014 都没有规格。它们的 `level.json` 和两张 `jpg` 来自外部茬图包，放在 `content/levels/{resourceId}/`。包里的 `assets/images/items/` 是单处切图，当前场景不加载。`content/specs/` 现在是空的。`npm run levels` 没有规格时直接结束，不改已有关卡。以后放进新规格，也只生成那一关，不会覆盖这些外部包。

## 关卡资源加载

游戏包里的代码只知道内容根地址。根地址来自 `ContentConfig`。场景不写死域名。

```ts
interface ContentConfig {
  catalogUrl: string
  levelBaseUrl: string
}

interface Catalog {
  schemaVersion: 'spot-catalog-v1'
  levels: Array<{ resourceId: string; title: string; order: number }>
}

interface LevelAssetUrl {
  key: string
  url: string
  kind: 'image' | 'audio' | 'json'
}
```

`levelBaseUrl` 不以斜杠结尾。第 `001` 关的配置是 `${levelBaseUrl}/001/level.json`。`AssetRef.path` 相对这一关目录拼接。

`listLevelAssetUrls` 放在 `src/game/levels/assets.ts`，不引用 Phaser。它收集 `pictures.top` 和 `pictures.bottom`。缺了任一张图，整关加载失败。

进关顺序：

1. 拉 `level.json`。HTTP 状态不是 2xx，或 JSON 过不了校验，停在失败页。
2. 用校验结果列出两张图的 URL。
3. 下载这些文件。浏览器解码后交给纹理；微信先 `wx.downloadFile`，再用本地路径解码。并发不超过 8。微信 HTTP 并发上限是 10。
4. 上下两张图摆好之后创建 `LevelSession`，这时才开始 `tick`。
5. 离开关卡时卸掉这一关的纹理。

进度：`level.json` 完成记 10%，其余按文件个数均分。玩法重试不走这套下载。

缓存键是 `resourceId + key + sha256`。没有摘要时用完整 URL 当键。浏览器第一版可以只靠 HTTP 缓存，接口仍走 `LevelCache`。微信把文件存到 `wx.env.USER_DATA_PATH/levels/`，缓存和用户文件共享 200MB。

首页先拉 `catalog.json`。名单顺序就是解锁顺序。目录失败时首页显示重试。第一版不在首页后台预下载下一关。

构建检查：产物目录里不能出现 `content/` 或 `levels/001` 的图片。

## 运行时会话

`LevelSession` 不引用 Phaser。

状态：

- `remainingMs`
- `found: Set<itemId>`
- `hintsLeft`，初始 3
- `phase: 'play' | 'won' | 'lost'`

`differenceAt(items, x, y)` 在图片坐标里找包含该点的圆，重叠时取圆心更近的一条。视图把指针换算成图片坐标后再调用。

- `tap(itemId | null)`：`null` 表示点在图内但没命中
- `tick(deltaMs)`
- `hint()`：返回下一条的 `itemId`、`tip`、圆心和半径，或 `null`
- `pause()` / `resume()`

`tap` 在 `phase !== 'play'` 时不改变进度。点中已找到的项不重复计数。找齐时 `phase` 变为 `won`。`tick` 只在 `play` 且未暂停时扣时间，扣到 0 变为 `lost`。

视图遵守会话。禁止在 Scene 里再写一套「点了就算找到」。

## 画面

入口按 Phaser skill `game-setup-and-config` 和 `scale-and-responsive`：`Phaser.AUTO`、`Scale.FIT`、`CENTER_BOTH`、750×1334。父节点 `#game-container` 必须有可计算的宽高。

场景职责：

- `BootScene`：只做跳转
- `HomeScene`：拉目录，和本地解锁进度拼出关卡入口
- `LevelScene`：`init` 收到 `resourceId`。加载完成后把两张图上下排列，原点在各自左上角。指针用 `pointerdown`，`pointer.x` / `pointer.y` 已是设计坐标。先判断落在上图还是下图，再换成图片坐标。`input.topOnly` 保持 true。圈和圆点用 Graphics 重画
- `ResultScene`：叠在关卡上。返回时停掉关卡场景

图片显示宽度不超过 694，高度不超过 500，两张图用同一个缩放，保证左右对齐、圆形不变形。

## 平台

```ts
interface Platform {
  content: ContentConfig
  cache: LevelCache
  loadProgress(): Progress
  saveProgress(progress: Progress): void
  onHide(listener: () => void): () => void
  onShow(listener: () => void): () => void
  loadLevelFile(url: string): Promise<unknown>
  loadLevelBinary(url: string): Promise<string>
}
```

`cleared` 存 `resourceId`。浏览器用 `localStorage`，键名 `phaser-maze.progress`。`session_key` 不出现在客户端。

`loadLevelFile` 在浏览器要检查 `response.ok`，并且 `cache: 'reload'`，避免同一地址上的旧关卡配置被当成新的。微信 `wx.request` 的 `success` 里仍要看 `statusCode`。`loadLevelBinary` 浏览器用原 URL，微信用 `wx.downloadFile` 的本地路径。

切后台时浏览器监听 `visibilitychange`，微信监听 `wx.onHide`。处理是暂停会话。回到前台调用 `resume`。解锁进度在过关当帧写入。

## 目录

```text
index.html
src/main.ts
src/game/config.ts
src/game/levels/types.ts
src/game/levels/validate.ts
src/game/levels/session.ts
src/game/levels/assets.ts
src/game/levels/catalog.ts
src/game/platform/web.ts
src/game/scenes/LevelScene.ts
scripts/build-diff-level.mjs
content/specs/
content/catalog.json
content/levels/001/level.json
content/levels/002/level.json
content/levels/003/level.json
content/levels/004/level.json
content/levels/014/level.json
docs/requirements.md
docs/development.md
docs/samples/level-001.json
```

`src/game/levels/` 和 `src/game/platform/` 禁止 import `phaser`。

包体：Phaser 4 和壳界面进主包。`content/` 不参与 Vite `public` 拷贝。本地开发用 Vite 中间件把 `content/` 挂到 `/content`，响应 `Cache-Control: no-cache`，改规格后刷新就能看到新图。生产环境的缓存由内容地址自己决定。

## 顺序

1. 校验器、`differenceAt` 和 `LevelSession`。
2. `scripts/build-diff-level.mjs` 从规格生成仍有规格的关卡，圆心像素必须不同。当前 001 到 014 都由外部茬图包提供。
3. `LevelScene` 上下两张图、套圈、圆点、提示、倒计时和结算。
4. 浏览器里走通点中、点空、找齐、重试和目录失败。
5. 微信探针以后再做。

## 当前进度

浏览器里是上下两张图的找不同。001 到 014 都用外部茬图包。图在 `content/`，不进构建产物。首页读目录，列表超出一屏可以上下拖动。解锁存在本地。微信运行时还没接。

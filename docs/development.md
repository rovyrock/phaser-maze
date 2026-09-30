# 找茬开发文档

玩家规则见 `docs/requirements.md`。本文定模块、关卡数据和实现顺序。先改文档，再写代码。

## 结论

用 Phaser 4 画场景和界面。找茬判定、倒计时和胜负写成不引用 Phaser 的 TypeScript，用 Vitest 测。浏览器用 Vite 跑。微信小游戏等核心循环可玩后再接，平台差异收进 `platform`。

Phaser 官方 skill 随 `phaser` 包发布，路径是 `node_modules/phaser/skills/`。搭工程时把需要的 skill 链接到 `.cursor/skills/`，实现时按 `.cursor/rules/engine-and-platform.mdc` 读取。微信侧读已放入仓库的 `.cursor/skills/wechat-minigame-dev/`（1.0.14）。该技能的引擎表是 Cocos、Laya、Egret、Unity 和原生 JS，没有 Phaser。渲染不改用那些引擎。`wx.*`、包体、分享和广告按该技能执行。

关卡协议参考 iWiki：

- [4022524132](https://iwiki.woa.com/p/4022524132)：`level.json` 的茬点、资源 slot 和逻辑模板。这是关卡难点的来源。
- [4022261994](https://iwiki.woa.com/p/4022261994)：茬点制作工具，导入原图后关联茬点并抠图。第一版不接这个工具。
- [4043585002](https://iwiki.woa.com/p/4043585002)：找茬合集的大厅、钥匙、战利品和实验分流。那是现网 Cocos 壳上的包装层，本仓库第一版不实现。

## 和 Cocos 协议的差异

4022524132 把位置放在 Cocos prefab 节点里，脚本只按节点名分发。Phaser 没有这套 prefab，所以位置必须写进关卡 JSON。语义字段尽量沿用，避免以后和关卡平台对不上。

| 协议里的概念 | 本仓库 |
| --- | --- |
| `schemaVersion: spot-level-v1` | `spot-level-phaser-v1`。多一个 `layout` |
| `gameCode`、`resourceId`、`configId` | 保留。`resourceId` 仍是三位数字，用来找目录 |
| `items[].logic.type` 与 `nodes` | 保留。节点名是逻辑键，不是 Cocos 节点路径 |
| prefab 里的坐标 | `layout.nodes[]` 的热区和图片位置，单位是设计像素，原点在左上，y 向下 |
| `EditorLevelConfig`、`PageMap` | 不生成。运行时只读 JSON |
| `story`、`endingChoice` | 类型先留在 schema 的可选字段里，第一版加载器忽略 |
| 合集大厅和 `/spot-script/hub` | 不做。进度只记在本地 |

`itemId` 稳定，改中文名或换图不变。`slug` 匹配 `^[a-z0-9]+(-[a-z0-9]+)*$`。`order` 从 1 开始，决定收集栏顺序。`targetCount` 必须等于 `needCollect !== false` 的条目数。

## 关卡数据

样例 `docs/samples/level-001.json` 是第一关，三个茬点都是直接点击。大图和状态切换的字段见上面的类型表，等对应关卡再各补一份样例。正式关卡以后放在 `public/levels/{resourceId}/level.json`，图片和音频放同目录。加载用 Phaser Loader 的 `this.load.json` 和 `this.load.image`，键用 `AssetRef.key`，同一目录内 key 唯一。

```ts
interface LevelFile {
  schemaVersion: 'spot-level-phaser-v1'
  gameCode: string
  level: {
    resourceId: string
    configId: number
    title: string
    description: string
    type: 'collect'
    targetCount: number
    totalTime: number
  }
  items: SpotItem[]
  layout: {
    background: AssetRef
    nodes: SceneNode[]
  }
}

interface SpotItem {
  itemId: string
  order: number
  slug: string
  displayName: string
  collectText: string
  tip: string
  dialogueText: string
  needCollect?: boolean
  assets: {
    collectImage?: AssetRef
    beforeImage?: AssetRef
    afterImage?: AssetRef
    bigImage?: AssetRef
    playAudio?: AssetRef
    effectAudio?: AssetRef
  }
  logic: ItemLogic
}

interface SceneNode {
  name: string
  x: number
  y: number
  depth: number
  visible: boolean
  imageKey?: string
  hit?: RectHit | CircleHit | PolygonHit
}

interface RectHit {
  kind: 'rect'
  x: number
  y: number
  width: number
  height: number
}
```

`x`、`y` 和热区都在 750×1334 设计坐标里。图片节点用中心点摆放。热区可以和图片不一致，命中测试以热区为准。

第一版实现并测试这三种 `logic.type`：

| type | 必填 | 行为 |
| --- | --- | --- |
| `directClick` | `nodes.collect`、`assets.collectImage`、该节点的 `hit` | 点中后 `collectTiming = onClick` |
| `bigImage` | 再加 `nodes.big`、`assets.bigImage` | `nodes.big` 初始隐藏。打开时 `inputLocked = true`。`autoDismissSec` 默认 2。关闭后收集，并在下一帧才解锁，防止点击穿透 |
| `clickChangeCollect` | 再加 `nodes.before`、`nodes.after`、两张状态图 | `before` 初始显示，`after` 初始隐藏。点中后互换可见性并收集 |

`nodes.*` 的值必须能在 `layout.nodes[].name` 里找到。可点节点必须有 `hit`。

校验失败就拒绝进关，错误信息要带上 `itemId`。规则与 4022524132 第 14 节对齐，并加上热区：

- `resourceId` 匹配 `^[0-9]{3}$`，`configId` 为正整数
- `itemId`、`slug`、`order` 各自唯一
- `targetCount` 与需要收集的条目数一致
- 每种 `logic.type` 的节点和资源 slot 都在
- `AssetRef.path` 以 `assets/` 开头，`key` 在本关唯一
- 第一版 `type` 只接受 `collect`

后续再加的模板，字段先按协议留名，未实现时校验器直接报「尚未支持」：

- `swipeRevealCollect`：`direction` 为 `left|right|up|down`，`minDistance` 默认 40，`maxDeviationDistance` 默认 120
- `swipeRevealBigImage`
- `doubleClick`：`maxIntervalMs` 默认 350
- `dragToTarget`：未命中时 `returnOnMiss` 默认 true
- `animationThenCollect`
- `dialogueChoice`

滑动和拖拽的几何判定也放在纯 TypeScript 里：给定起点、终点和方向阈值，返回是否成立。Phaser 只把指针轨迹交进去。

## 运行时会话

`LevelSession` 不引用 Phaser。构造时吃进校验后的关卡和 `now` 函数。

状态：

- `remainingMs`
- `found: Set<itemId>`
- `hintsLeft`，初始 3
- `phase: 'play' | 'bigImage' | 'won' | 'lost'`
- `inputLocked`
- `visibleNodes: Set<nodeName>`

输入是意图，不是坐标。视图先做命中测试，再调用：

- `tap(nodeName)`
- `dismissBigImage()`
- `tick(deltaMs)`
- `hint()`：返回要高亮的 `itemId` 和 `tip`，或 `null`
- `pause()` / `resume()`

`tap` 在 `phase !== 'play'` 或 `inputLocked` 时不改变收集。点中已收集项不重复计数。收齐时 `phase` 变为 `won`。`tick` 只在 `play` 且未暂停时扣时间，扣到 0 变为 `lost`。大图阶段不扣时间。

视图遵守会话。禁止在 Scene 里再写一套「点了就算找到」。

## 画面

入口按 Phaser skill `game-setup-and-config` 和 `scale-and-responsive`：

```ts
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 750,
    height: 1334,
  },
  scene: [BootScene, HomeScene, LevelScene, ResultScene],
}
```

父节点 `#game-container` 必须有可计算的宽高，否则 `CENTER_BOTH` 不会居中。

场景职责：

- `BootScene`：只做跳转，不加载全部关卡图
- `HomeScene`：读本地进度，画关卡入口
- `LevelScene`：`preload` 只加载这一关。`create` 按 `layout` 摆节点，热区用 `setInteractive` 的矩形、圆或多边形。`input.topOnly` 保持默认 true。收集飞入用 tween。大图是同一场景里的高层容器，不新开 Scene，这样锁输入和穿透更好测
- `ResultScene`：可以叠在关卡上启动，由 `LevelScene` 传入胜负。返回时停掉关卡场景

音频在浏览器走 Phaser Sound。微信实现时改成 `wx.createInnerAudioContext()`，播完销毁。关卡没配音频时静音，不报错。

对象需要反复创建的只有收集飞入的缩略图和点击反馈。这两种用完隐藏回池，不每点一次 `destroy`。

## 平台

```ts
interface Platform {
  loadProgress(): Progress
  saveProgress(progress: Progress): void
  onHide(listener: () => void): void
  onShow(listener: () => void): void
}

interface Progress {
  cleared: string[]
}
```

`cleared` 存 `resourceId`。浏览器用 `localStorage`，键名 `phaser-maze.progress`。微信以后用本地存储，不在第一版做登录。`session_key` 不出现在客户端。

切后台时浏览器监听 `visibilitychange`，微信监听 `wx.onHide`。处理是暂停会话。第一版回到前台调用 `resume`，不恢复到半截大图；若暂停时大图开着，先按手动关闭的同一路径关掉再继续。解锁进度在过关当帧写入，不依赖对局中的自动存档。

## 目录

搭工程时按这个放，未出现的文件不要提前造一层空壳。

```text
index.html
src/main.ts
src/game/config.ts
src/game/levels/types.ts
src/game/levels/validate.ts
src/game/levels/validate.test.ts
src/game/levels/session.ts
src/game/levels/session.test.ts
src/game/levels/catalog.ts
src/game/platform/types.ts
src/game/platform/web.ts
src/game/scenes/BootScene.ts
src/game/scenes/HomeScene.ts
src/game/scenes/LevelScene.ts
src/game/scenes/ResultScene.ts
public/levels/001/level.json
docs/requirements.md
docs/development.md
docs/samples/level-001.json
```

`src/game/levels/` 和 `src/game/platform/` 禁止 import `phaser`。

包体：Phaser 4 进主包。第一关图片进主包。后续关卡图片按 `resourceId` 分目录，微信阶段再映射到分包。音效不进主包。

## 顺序

1. Vite、TypeScript、Phaser 4、Vitest。竖屏空场景。把 `node_modules/phaser/skills` 链到 `.cursor/skills/`。
2. 校验器和 `LevelSession`，覆盖直接点击、点空、重复点击、大图锁定与关闭后收集、状态切换、提示次数、倒计时暂停、胜负。样例 JSON 必须能通过校验。
3. 用占位图做出第 1 关：能点、能收集、时间到失败、找齐胜利、提示 3 次。
4. 首页、结算、本地解锁。再加一关大图、一关状态切换。
5. 浏览器里按需求文档的验收走一遍。
6. 滑动、双击、拖拽。每种先补会话测试，再补视图。
7. 微信探针：开发者工具能开第 1 关、解锁能留下、一次点击音效能响。通过后再谈分享和激励视频。真机以 iOS 和 Android 为准，开发者工具只作调试。

第 6 步之前不接 4022261994 的制作工具，也不做 4043585002 的大厅和发奖。那些依赖现网剧本服务和实验平台，和单机第一版不是一条链路。

## 当前进度

文档和仓库规则已写好。还没有游戏代码，也没有可玩场景。

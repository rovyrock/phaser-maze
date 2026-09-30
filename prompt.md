# 对话记录

## 2026-09-30

**用户：** 初始化仓库并提交到 GitHub。以后每次修改都要 git commit。做一款 Phaser 找茬小游戏，先输出需求文档和开发文档，开发放在文档之后。实现前要看 Phaser skill 和微信小游戏 skill。关卡是难点，参考 iWiki：

- https://iwiki.woa.com/p/4022524132
- https://iwiki.woa.com/p/4022261994
- https://iwiki.woa.com/p/4043585002

**处理：** 本地目录原先是空的，还不是 Git 仓库。Phaser 官方 skill 在连点项目已安装的 Phaser 4 包里，路径 `node_modules/phaser/skills/`，本仓库搭工程前先按那些 skill 写约束，不把另一份 `node_modules` 拷过来。微信小游戏 skill 1.0.14 从连点项目的 `.cursor/skills/wechat-minigame-dev/` 拷入本仓库。该技能没有 Phaser 引擎章节，平台规则照用，渲染仍用 Phaser 4。

三篇 iWiki 的用法：4022524132 的 `level.json` 逻辑模板作为关卡数据来源，并补上 Phaser 需要的热区坐标，schema 定为 `spot-level-phaser-v1`。4022261994 的抠图工具和 4043585002 的大厅、钥匙、战利品不进第一版。

已写 `.cursor/rules/commit-every-change.mdc`、`docs-first.mdc`、`engine-and-platform.mdc`，以及 `docs/requirements.md`、`docs/development.md`、`docs/samples/level-001.json`。游戏代码尚未开始。仓库推到 GitHub `rovyrock/phaser-maze`。

**用户：** 关卡资源不能直接打包在游戏包内，后续需要再加载。

**处理：** 需求改为进关时单独拉取该关配置和图片，加载完成才开始倒计时；加载失败可重试或返回。开发文档把关卡文件放到包外的 `content/`，由 `ContentConfig` 指向内容地址。游戏包只留引擎和壳界面，主包和分包都不收关卡图。名单来自远程 `catalog.json`。微信用 `wx.request` / `wx.downloadFile`，域名进入下载文件合法域名。未写游戏代码，未推送。

**用户：** 可以，继续。

**处理：** 按文档搭了 Phaser 4 工程。判定在不依赖 Phaser 的 `LevelSession` 里，用 Vitest 覆盖。关卡图放在 `content/`，开发服务器挂到 `/content`，不进构建产物。浏览器里三关都能玩：第 1 关直接点击，第 2 关大图打开时点别的不会收集，关闭后才计入；第 3 关点击后切换茶杯状态并收集。首页读目录，通关解锁写在本地。内容地址连不上时首页显示目录加载失败和重试。同一场景重开时 Phaser Loader 队列会停在半截进度，图片改为解码后交给纹理管理器，并发不超过 8。未推送。

**用户：** 希望有一条自动化工作流，生成关卡茬图素材和关卡数据。随后说明玩法不对：竖屏，应该是上下两张图，找出不同。

**处理：** 玩法改成竖屏上下两张图对比找不同。规格放在 `content/specs/`，`npm run levels` 画出两张图并写出 `level.json`，圆心像素不同才会生成成功。浏览器里第 1 关「庭院」上下两张图可见，点中皮球后两边都套圈，圆点亮起。点错不扣时间、不扣命。未推送。

**用户：** 捋一下 https://zhuanlan.zhihu.com/p/526382279 ，把文里的现成素材当作茬图。

**处理：** 知乎原文要登录。同题转载说明这是匈牙利插画家杜多夫（Dudolf）的 8 组找茬：每组两张分开的图，不同处数量依次是 7、8、9、7、7、10、7、7。图上有 dudolf.com 水印，没有现成坐标。这些图不进仓库。未改关卡。

**用户：** 把 `/Users/rovyrock/Downloads/spot-the-difference-001.zip` 这套茬图接进来看看。

**处理：** 包内已是 `diff-level-phaser-v1`，第 1 关换成「山羊草地」：上下两张 640×460 的 jpg，5 处（犄角、眼睛、斑纹、小花、铃铛）。单处切图放在关卡目录，场景不加载。`npm run levels` 不再覆盖第 1 关。浏览器里首页显示山羊草地，进关后点中下图小花，两边套圈，计数变成 1/5。未推送。

**用户：** 把 `/Users/rovyrock/Downloads/spot-the-difference-002.zip` 也接进来。

**处理：** 第 2 关换成「厨房里的猫」：上下两张 640×460 的 jpg，5 处（果酱罐、猫的斑纹、陶罐、麻袋苹果、地上苹果）。包里的 slug 带下划线，校验原先不认，已放行。生成脚本不再覆盖第 2 关。浏览器里通过第 1 关后进入第 2 关，点中地上苹果，两边套圈，计数变成 1/5。未推送。

**用户：** 把 `/Users/rovyrock/Downloads/spot-the-difference-003.zip` 新增为一个关卡。

**处理：** 包的编号是 003，第 3 关从生成的「书桌」换成「运车的卡车」：上下两张 640×460 的 jpg，3 处（左边的车、右边的车、树丛）。规格目录清空，`npm run levels` 没有规格时直接结束。浏览器里通过前两关后进入第 3 关，点中左边的车，两边套圈，计数变成 1/3。未推送。

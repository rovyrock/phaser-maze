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

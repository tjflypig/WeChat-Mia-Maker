# WeChat Mia Maker

Mia Studio 是一个自托管的微信公众号创作工作台，覆盖选题、素材、编辑、AI 辅助、微信预览和草稿发布。

项目使用 doocs/md 的编辑与渲染能力作为发动机，但建立独立的产品外壳、腾讯云本地数据层、CLI 和 Agent/MCP 接口。

## Core principles

- Markdown 和相对路径素材是唯一事实来源。
- Web、手机、Obsidian、CLI 和 Agent 操作同一份 Vault。
- AI 和微信密钥仅存在服务端。
- AI 产出默认是 proposal，不在未确认时覆盖正文。
- 发布基于通过预检的不可变文章快照。

## Workspace

```text
apps/
  mia-studio/          Vue 3 / Vite responsive Web/PWA
  mia-api/             Auth and Vault HTTP API
packages/
  workspace/           Markdown Vault and conflict control
  mia-cli/             `mia` command line
```

`mia-studio`、doocs/md adapter、AI、微信发布和 MCP 将沿着同一领域模型逐步接入，不会复制一套平行数据。

doocs/md 的导出、一键换模板、社区模板、文字统计、实时预览、图片处理、AI、历史版本等能力默认全部保留，详见 [doocs/md 能力引入清单](docs/DOOCS-CAPABILITY-MAP.md)。

上游源码以 Git 子模块锁定在 [`vendor/doocs-md`](vendor/doocs-md)，当前基线为 `ff932394d975d9a2f96456df7bbec4d024cd4ba1`。更新上游必须单独评审，不能在 Mia 中复制组件。

## Quick start

需要 Node.js 22 和 pnpm 11：

```bash
pnpm install
pnpm mia vault init ./vault
pnpm mia topic add "给孩子做一个本地 AI 玩具" --vault ./vault
pnpm mia topic list --vault ./vault
```

启动 API 前复制并填写 `.env.example` 中的环境变量，再执行：

```bash
set -a
source .env
set +a
pnpm api
```

另一个终端启动 Web 工作台：

```bash
pnpm studio
```

API 默认使用 `/v1`，支持登录会话、Bearer token、选题创建/立项、文章创建/读写。文章写入必须携带 `If-Match` ETag，防止电脑、手机和 Agent 相互覆盖。

## Version

The current application-shell version is `0.3.0`. See [docs/VERSIONING.md](docs/VERSIONING.md).

## Status

Phase 1 已实现 Markdown Vault、登录 API、CLI 和桌面/手机统一工作台。当前预览是明确标识的基础预览；doocs/md 最终渲染、AI 网关和微信草稿接口尚未接入。生产密钥、真实 Vault 内容和生成产物不得提交。

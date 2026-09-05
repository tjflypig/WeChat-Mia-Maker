# WeChat Mia Maker

Mia Studio 是一个自托管的微信公众号创作工作台，覆盖选题、素材、编辑、AI 辅助、微信预览和草稿发布。

项目使用 doocs/md 的原生 Web 编辑器与渲染能力作为发动机，在其外围接入腾讯云本地数据层、CLI、Agent/MCP 和微信发布服务。

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

`mia-studio` 直接宿主 doocs/md 的 CodeMirror、实时预览、模板、导出、AI、图片和历史版本能力，不维护第二套编辑器。

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

Agent 或 Obsidian 完成草稿后，通过 CLI 推送到 Studio：

```bash
export MIA_API_URL="https://你的-mia-studio-地址"
export MIA_API_TOKEN="服务端配置的-token"
pnpm mia article push "/绝对路径/草稿.md"
```

首次推送成功后，CLI 会把 Studio 文章 ID 写入源文件 frontmatter。之后重复执行同一命令会更新同一篇文章，不会新建重复稿件；如不希望修改源文件，可加 `--no-write-id`。

API 默认使用 `/v1`，支持登录会话、Bearer token、选题创建/立项、文章创建/读写。文章写入必须携带 `If-Match` ETag，防止电脑、手机和 Agent 相互覆盖。

## Version

The current application version is `0.6.0`. See [docs/VERSIONING.md](docs/VERSIONING.md).

## Status

已实现 Markdown Vault、登录 API、Agent/Obsidian CLI 推送、doocs/md 原生工作台，以及复用旧版微信引擎的“最终渲染 HTML → 预检 → 二次确认 → 微信草稿”链路。下一主线是发布回执与最终快照回写 Obsidian。生产密钥、真实 Vault 内容和生成产物不得提交。

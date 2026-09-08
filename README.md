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

在 Studio 完成图片、排版和发布后，可将云端规范 Markdown 拉回 Obsidian：

```bash
pnpm mia article pull "article-id" --file "/绝对路径/Obsidian文章.md"
```

同一文章 ID 的本地文件会被更新；内容不同时，旧稿先保存为 `.mia-backup`。目标文件属于另一文章时默认拒绝覆盖，确认需要覆盖时才使用 `--force`。服务器无法直接写入个人电脑磁盘，因此这条 CLI 命令也是 Agent、Obsidian 自动化和定时同步的可靠边界。

API 默认使用 `/v1`，支持登录会话、Bearer token、选题创建/立项、文章创建/读写。文章写入必须携带 `If-Match` ETag，防止电脑、手机和 Agent 相互覆盖。

编辑器中的图片上传会直接写入当前文章的 `assets/` 目录，不需要配置第三方图床。顶部“封面”按钮用于上传并绑定文章封面；发布时，腾讯云上的旧版微信发布引擎会读取这些签名素材地址，将正文图片和封面转存到微信 CDN，再提交最终 doocs 渲染 HTML。生产环境需设置 `MIA_PUBLIC_URL` 为 Studio 的 HTTPS 公网地址。

## Version

The current application version is `0.9.1`. See [docs/VERSIONING.md](docs/VERSIONING.md).

## Status

已实现 Markdown Vault、登录 API、Agent/Obsidian CLI 双向同步、doocs/md 原生工作台，以及复用旧版微信引擎的“最终渲染 HTML → 预检 → 二次确认 → 微信草稿 → 不可变回执归档”链路。生产密钥、真实 Vault 内容和生成产物不得提交。

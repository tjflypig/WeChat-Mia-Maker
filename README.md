# WeChat Mia Maker

Mia Studio 是一个自托管的微信公众号创作工作台，覆盖选题、素材、编辑、AI 辅助、微信预览和草稿发布。

项目使用 doocs/md 的编辑与渲染能力作为发动机，但建立独立的产品外壳、腾讯云本地数据层、CLI 和 Agent/MCP 接口。

## Core principles

- Markdown 和相对路径素材是唯一事实来源。
- Web、手机、Obsidian、CLI 和 Agent 操作同一份 Vault。
- AI 和微信密钥仅存在服务端。
- AI 产出默认是 proposal，不在未确认时覆盖正文。
- 发布基于通过预检的不可变文章快照。

## Planned workspace

```text
apps/
  mia-studio/          Vue 3 / Vite / PWA
  mia-api/             Auth, Vault, AI and publish API
packages/
  core/                doocs/md rendering engine adapter
  ai-core/             Provider, streaming and diff contracts
  workspace/           Markdown Vault and conflict control
  wechat-publisher/     Preflight, image and draft pipeline
  mia-cli/             `mia` command line
  mcp-server/          Agent integration
```

## Version

The current design-foundation version is `0.1.0`. See [docs/VERSIONING.md](docs/VERSIONING.md).

## Status

The repository is in architecture and foundation stage. Production credentials, real Vault content and generated artifacts must never be committed.

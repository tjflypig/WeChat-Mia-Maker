# Doocs 原生工作台宿主边界

Mia 不复制 doocs/md 的编辑器、预览、模板、导出、AI 或图片处理逻辑。`vendor/doocs-md` 是锁定版本的上游子模块，使用它自己的 workspace 安装和构建：

```bash
pnpm doocs:dev
pnpm doocs:build
```

## 集成原则

- `@md/web` 保持原生入口 `CodemirrorEditor`，包含 CodeMirror、实时预览、分屏、模板/社区模板、导出、统计、历史版本、快捷键、图片、公式、Mermaid、AI 等能力。
- Mia 只提供外围 Host Bridge：登录态、腾讯云 Vault 文件、素材上传、文章保存、发布预检和微信草稿 API。
- 不使用 iframe 作为主交互；正式整合应把 doocs 的 Web 入口作为应用工作台，并在其 store/service 边界注入桥接实现。

## Bridge 合约（v0）

```ts
export interface MiaDoocsHostBridge {
  loadDocument(id: string): Promise<{
    content: string
    etag: string
    metadata: Record<string, unknown>
  }>
  saveDocument(id: string, content: string, etag: string): Promise<{
    content: string
    etag: string
  }>
  uploadAsset(file: File, articleId: string): Promise<{
    relativePath: string
    url?: string
  }>
  getCurrentArticleId(): string | null
  publishPreflight(id: string): Promise<unknown>
}
```

`loadDocument/saveDocument` 必须透传 ETag 冲突；保存失败时不得覆盖编辑器当前内容。素材使用文章目录下的相对路径，发布阶段再由 Mia 服务替换为微信 CDN 地址。

## 本地启动

`pnpm studio` 仍启动 Mia 外围壳（端口 4173），`pnpm doocs:dev` 启动原生 doocs Web。依赖未安装时只需在子模块目录执行一次 `pnpm install`，不会把 doocs 的 10 个 workspace 纳入 Mia 根 workspace。

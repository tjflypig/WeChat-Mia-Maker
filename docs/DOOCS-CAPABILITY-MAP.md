# doocs/md 能力引入清单

Mia Studio 不重新实现 Markdown 编辑器。`tools/md-editor` 是主交互引擎，Mia 只提供外围数据与发布服务。

## 必须保留的原生能力

| 能力 | doocs/md 模块 | Mia 接入方式 |
| --- | --- | --- |
| CodeMirror 编辑 | `components/editor/CodemirrorEditor.vue` | 作为唯一正文编辑器 |
| 实时预览/分屏 | `PreviewPanel.vue`, `CodemirrorEditor.vue` | 保留分屏、移动预览和同步滚动 |
| 样式与一键换模板 | `StyleDropdown.vue`, `StyleOptionMenu.vue`, `theme/*` | 继承原有主题模型，Mia 仅提供默认主题 |
| 社区模板 | `MarketplaceDialog.vue`, `stores/marketplace.ts` | 保留浏览、安装、更新和回滚 |
| 文字统计/阅读时长 | `Footer.vue`, `readingTime`, `countStatus` | 直接复用，不在 Mia 重写 |
| 导出 | `services/export`, `PdfExportDialog.vue`, `pureHtml.ts` | 保留 HTML/PDF/主题导出，文件写入 Mia Vault |
| 快捷键与命令面板 | `CommandPalette.vue`, `keyboard-shortcuts.ts` | 保留原快捷键，只增加 Mia 命令 |
| AI 能力 | `useAIFetch.ts`, `stores/aiConfig.ts` | 保留 UI 与提案交互，Key 改由 Mia API 代理 |
| 图片、数学、Mermaid、Alert | `packages/core/src/extensions/*` | 完整保留，不做平替实现 |
| 历史、版本、Diff | `post-slider/*`, `VersionDiffViewer.vue` | 与 Mia ETag/修订版本对接 |
| 本地图像和文件夹 | `LocalImageUploadDialog.vue`, `folder-source-panel/*` | 默认目标改为 Vault 文章目录 |

## Mia 允许替换的部分

- 登录、会话、权限和服务端网关。
- 文件夹根目录、Vault 同步、ETag 冲突和 Obsidian/CLI/MCP 读写。
- 腾讯云本地数据和密钥管理。
- 选题雷达、素材流转、微信发布预检与草稿接口。

## 明确不做

- 不在 Mia 重写另一个 textarea/CodeMirror 编辑器。
- 不另起一套主题、社区模板或导出格式系统。
- 不把低频云同步、分享地址和多云图床塞进主编辑路径；这些属于 Mia 外围配置。

## 集成门禁

Mia 的 PR 不能新增编辑、预览、模板、导出或 AI 的平行实现，除非先证明 doocs/md 原生能力无法通过适配层复用。

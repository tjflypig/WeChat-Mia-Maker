# Architecture

## Boundary

Mia Studio 不重新实现 doocs/md 的编辑和预览。它以 doocs/md 的 Web 编辑器和核心作为主交互，用适配层把文档状态、图片存储和服务端凭据接入。详细保留清单见 [DOOCS-CAPABILITY-MAP.md](DOOCS-CAPABILITY-MAP.md)。

## Components

```text
doocs/md Editor + Preview + AI UI (`vendor/doocs-md`)
  -> Mia Studio host shell
       -> Mia API /v1
       -> Markdown Vault (source of truth)
       -> SQLite (index, sessions and jobs)
       -> AI gateway (server-side credentials)
       -> doocs/md renderer and editor adapter
       -> WeChat publisher

Mia CLI / Obsidian / MCP
  -> the same Mia API and Vault contracts
```

## Data

- `00-inbox/`: mobile, CLI and Agent quick captures.
- `10-topics/`: one Markdown file per topic to reduce concurrent-write conflicts.
- `20-materials/`: reusable clips and unattached source assets.
- `30-articles/<slug>/index.md`: article body and frontmatter.
- `30-articles/<slug>/assets/`: article-local source assets referenced with relative paths.
- `30-articles/<slug>/reports/`: AI and preflight reports.
- `30-articles/<slug>/publish/`: immutable publish receipts.

All writes use atomic replacement and content-hash ETags. Stale writes return `409` with enough information to show a non-destructive diff.

## AI and radar

Provider configuration and credentials are server-side. The UI exposes task-oriented actions: topic radar, outline, selected-text refinement, style-DNA review, title and summary suggestions. Suggestions are proposals and require explicit acceptance.

Radar sources normalize into candidate topic files. Candidates retain source and scoring reasons and must pass three explainable gates: hands-on experiment, unique real-world detail and useful insight. Radar never starts or publishes an article automatically.

## Publishing

Publishing snapshots a specific article revision, validates metadata and assets, renders through the doocs/md engine, moves images to the official WeChat CDN, uploads the cover, calls `draft/add`, and records an immutable receipt. The complete preflight and publish flow is available on desktop and mobile.

The production Nginx route must use `location ^~ /v1/` as shown in [`deploy/nginx/mia-studio-8088.conf`](../deploy/nginx/mia-studio-8088.conf). Signed Vault asset URLs end in image extensions; a plain prefix location can otherwise lose precedence to the static-file regular expression and return 404 before the API sees the request.

# Changelog

All notable changes are recorded here. The project follows Semantic Versioning and Keep a Changelog conventions.

## [Unreleased]

## [0.6.0] - 2026-09-05

### Added

- Native doocs/md header action for publishing the current rendered and inlined WeChat HTML to the draft box.
- Server-side preflight and single-use, ten-minute second-confirmation contract bound to the article ETag and rendered HTML hash.
- Adapter for reusing the proven legacy `mia-core.publishHtml()` WeChat image, cover and `draft/add` pipeline on Tencent Cloud.
- Desktop and mobile publishing feedback with version, image count and rendered HTML byte size.

### Security

- Markdown is never accepted as the publish snapshot; scripts are rejected and WeChat credentials remain server-side.
- A changed article or replayed confirmation is rejected before calling the WeChat API.

## [0.5.0] - 2026-09-05

### Added

- `mia article push <file.md>` for Agent and Obsidian drafts to enter Mia Studio through the authenticated API.
- Stable article identity written back to source frontmatter after the first successful push.
- Repeat pushes update the same article with ETag protection while preserving Studio-managed metadata.

### Fixed

- Restored the full doocs/md Tailwind source scan in Mia's independent Vite build; editor, preview, menus and responsive utilities no longer render as an unstyled jumble.
- Corrected the login gate password selector so the hidden username field cannot be submitted as the password.

## [0.4.0] - 2026-09-04

### Added

- doocs/md native Web application as the Mia Studio editing workspace.
- Accessible password gate before the doocs application bootstrap.
- Tencent Cloud Vault document repository injected at the doocs persistence boundary.
- Cloud article creation with client-stable IDs and body-only editing while preserving Vault frontmatter.
- Conflict-safe automatic saves backed by article ETags.

### Changed

- Replaced the temporary textarea editor entry with doocs CodeMirror, live preview, templates, exports, AI, image tools and history UI.

## [0.3.1] - 2026-09-04

### Added

- `@mia/md-adapter` as the single renderer boundary for doocs/md injection.
- Explicit degraded preview mode when the doocs workspace is not available.
- Adapter contract tests covering injected and fallback renderer behavior.

## [0.3.0] - 2026-09-04

### Added

- Responsive Vue 3 application shell for desktop, tablet and mobile.
- Password login, article library, topic capture and topic promotion flows.
- Focused Markdown body editor with automatic and keyboard-triggered server saves.
- Mobile five-stage navigation for topics, materials, writing, preview and publishing.
- Honest publish preflight state and contextual AI inspector placeholders.
- Installable web-app manifest and network-first application-shell service worker.
- Version-controlled product and visual design foundations.

### Fixed

- Hidden frontmatter from the writing surface while preserving it on save.
- Removed closed mobile drawers from visual and keyboard navigation.

## [0.2.0] - 2026-09-04

### Added

- Markdown Vault initialization and schema metadata.
- Atomic article and topic storage with content-hash ETags.
- Conflict-safe article updates and topic-to-article promotion.
- Initial `mia` CLI for Vault, topic and article workflows.
- Authenticated `/v1` API for Web, CLI and Agent clients.
- Node test coverage for workspace and API contracts.

## [0.1.0] - 2026-09-04

### Added

- Established the independent Mia Studio v2 repository.
- Defined doocs/md as the editing and rendering engine rather than the product shell.
- Defined the Web, Tencent Cloud Vault, CLI, Obsidian and Agent integration boundaries.

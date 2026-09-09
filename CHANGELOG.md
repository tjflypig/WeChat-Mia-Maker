# Changelog

All notable changes are recorded here. The project follows Semantic Versioning and Keep a Changelog conventions.

## [Unreleased]

## [0.9.2] - 2026-09-09

### Changed

- AI cover rules are now editable in the generation dialog and persist in the current browser.
- Authors can restore the default cover rules or remove conflicting constraints before generation.

## [0.9.1] - 2026-09-08

### Changed

- AI cover prompts now combine fixed WeChat cover constraints with the current article title, summary and Markdown-derived excerpt.
- The cover dialog now accepts optional art direction instead of requiring authors to restate the article context and output format.

## [0.9.0] - 2026-09-08

### Added

- Review-first AI cover flow with final 900×383 preview, regeneration, download and explicit confirmation before Vault upload.
- Recoverable server-side article archival through an ETag-protected `DELETE /v1/articles/:id` endpoint.

### Fixed

- Deleting or batch-deleting a doocs document now persists to Tencent Cloud instead of returning after reload.
- Reading-time output no longer uses WeChat's editable blockquote element, keeping its exported height aligned with Mia preview.

## [0.8.3] - 2026-09-08

### Added

- AI cover generation action using the existing doocs image-service configuration.
- Fixed 900×383 JPEG cover output, cropped client-side before Vault upload.

## [0.8.2] - 2026-09-08

### Changed

- Replaced upstream doocs product, feedback and donation links with Mia Studio and its credited doocs/md rendering-engine references.

## [0.8.1] - 2026-09-08

### Fixed

- Restored the Mia cover and WeChat draft actions in the native doocs mobile header.

## [0.8.0] - 2026-09-08

### Added

- A visible cover upload action beside the native doocs publish action, persisted as article frontmatter metadata.
- Authenticated article asset uploads backed by each article's Vault `assets/` directory.
- Signed read-only asset URLs so the Tencent Cloud publisher can fetch local images and transfer them to the WeChat CDN during publishing.

### Changed

- Native doocs image upload tools now target Mia Vault storage and no longer require a separate image-host configuration.
- Publish preflight forwards the selected cover URL while continuing to publish only the final doocs rendered HTML snapshot.

## [0.7.0] - 2026-09-05

### Added

- Immutable per-publish folders containing the canonical Markdown, exact doocs rendered HTML sent to the publisher, and the WeChat draft receipt.
- Authenticated publish receipt listing endpoint.
- `mia article pull <article-id> --file <path>` for bringing the Studio version back into Obsidian or an Agent workspace.
- Recoverable pull behavior with `.mia-backup` and article-ID mismatch protection.

### Fixed

- A successful WeChat draft no longer appears to fail when only receipt persistence fails; the API returns the draft result with an explicit archive warning to prevent duplicate retries.

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

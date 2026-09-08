---
name: mia-studio-cli
description: Use the Mia Studio CLI to move Markdown drafts between an Agent or Obsidian and the authenticated Mia Studio workspace. Applies when an Agent needs to push a draft, inspect article state, or pull the Studio version back after editing and publishing.
metadata:
  short-description: Agent and Obsidian workflow for Mia Studio CLI
---

# Mia Studio CLI

Use this skill as the integration boundary for the Mia Studio writing workflow:

`Agent/Obsidian Markdown -> mia article push -> Mia Studio doocs/md editing and publishing -> mia article pull -> Obsidian backup`

The CLI moves Markdown and metadata. It does not render HTML, call WeChat, upload images, or bypass the Studio confirmation flow. Publishing must happen in Mia Studio, where doocs/md produces the rendered HTML and the server performs preflight plus the second confirmation.

## Environment

Set these variables before remote commands:

```bash
export MIA_API_URL="https://gzh.lgzzz.top"
export MIA_API_TOKEN="<token from the operator>"
```

Never print, commit, or place `MIA_API_TOKEN` in Markdown, frontmatter, shell history, or generated files. Do not invent a token. If it is missing, stop and ask the operator to configure it.

The CLI can also receive `--api` and `--token`; environment variables are preferred so tokens do not appear in copied command text.

## Draft To Studio

For a new draft, push the Markdown file:

```bash
pnpm mia article push "/absolute/path/draft.md"
```

The first successful push creates one Studio article and writes its stable `id` into the source frontmatter. Repeat pushes update that same article. Studio-managed fields such as `schema_version`, timestamps, revision, and status are preserved; editable frontmatter from the source is merged.

Use JSON when another program needs machine-readable output:

```bash
pnpm mia article push "/absolute/path/draft.md" --json
```

Use `--no-write-id` only when the source file must remain byte-for-byte unchanged. Prefer the normal behavior for Obsidian files so later pulls have a stable identity.

## Inspect State

```bash
pnpm mia article list --json
pnpm mia article show "article-id" --json
```

Use the returned `etag` to understand the current Studio version. Do not manually edit the cloud Vault or use `article write` unless the operator explicitly asks for a low-level, ETag-aware write.

## Pull Back To Obsidian

After the human finishes doocs/md editing, image handling, layout review, and the confirmed WeChat draft publish, pull the canonical Studio Markdown back:

```bash
pnpm mia article pull "article-id" --file "/absolute/path/Obsidian/article.md"
```

If the target already contains different content, the CLI writes the old content to `article.md.mia-backup` before replacing it. If the target has a different article ID, the command refuses to overwrite it. Only use `--force` after the operator explicitly confirms that the target is intentionally being replaced:

```bash
pnpm mia article pull "article-id" --file "/absolute/path/Obsidian/article.md" --force
```

The server cannot write a path on the Agent's computer. A local Agent, Obsidian command, or scheduled job must execute `pull`.

## Topics

Use the topic commands for lightweight capture and promotion:

```bash
pnpm mia topic add "topic title" --source agent --pillar "pillar-name" --json
pnpm mia topic list --status candidate --json
pnpm mia topic pick "topic-id" --json
```

`topic pick` creates an article in the Studio workspace. Push the resulting article Markdown only when a source file exists that should become its Obsidian/Agent counterpart.

## Error Handling

- `missing_api_token` or `api_unreachable`: stop; do not retry blindly.
- `401 unauthorized`: verify the API URL and token with the operator; never guess credentials.
- `409 conflict`: fetch/show the current article, preserve the newer version, and ask whether to merge before pushing again.
- `pull_target_mismatch`: inspect the local frontmatter; do not add `--force` automatically.
- `receiptWarning` after a Studio publish: the WeChat draft may already exist. Do not retry publishing; inspect the receipt endpoint or have the operator check Studio before taking action.

## Operating Rules

- Treat the Markdown file as the Agent/Obsidian source and the Studio article as the editing authority after push.
- Never publish by calling an undocumented endpoint or by sending Markdown to WeChat.
- Never call `--force` to resolve an unknown conflict.
- Prefer `--json` for automation and normal output for humans.
- After a successful pull, report the target path and any `.mia-backup` path to the operator.

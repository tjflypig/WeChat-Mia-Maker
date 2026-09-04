/**
 * Stable Mia boundary around doocs/md's renderer.
 *
 * The doocs workspace is intentionally injected by the host instead of being
 * copied or treated as an npm package. `createDoocsAdapter` accepts the two
 * functions exported by @md/core; this keeps Web, API, CLI and MCP on one
 * renderer contract while allowing a safe preview when the engine is absent.
 */
export function createDoocsAdapter({ initRenderer, renderMarkdown } = {}) {
  if (typeof initRenderer !== `function` || typeof renderMarkdown !== `function`)
    return createFallbackAdapter()

  const renderer = initRenderer({
    countStatus: true,
    isMacCodeBlock: true,
    themeMode: `light`,
  })
  return {
    engine: `doocs/md`,
    degraded: false,
    render(raw) {
      const rendered = renderMarkdown(String(raw), renderer)
      return {
        html: rendered.html,
        readingTime: rendered.readingTime,
        engine: `doocs/md`,
        degraded: false,
      }
    },
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, `&amp;`)
    .replace(/</g, `&lt;`)
    .replace(/>/g, `&gt;`)
    .replace(/"/g, `&quot;`)
    .replace(/'/g, `&#39;`)
}

function createFallbackAdapter() {
  return {
    engine: `fallback`,
    degraded: true,
    render(raw) {
      const body = String(raw).replace(/^---\n[\s\S]*?\n---\n?/, ``)
      const html = body.split(`\n`).map(line => {
        const escaped = escapeHtml(line)
        if (line.startsWith(`### `)) return `<h3>${escaped.slice(4)}</h3>`
        if (line.startsWith(`## `)) return `<h2>${escaped.slice(3)}</h2>`
        if (line.startsWith(`# `)) return `<h1>${escaped.slice(2)}</h1>`
        if (line.startsWith(`> `)) return `<blockquote>${escaped.slice(2)}</blockquote>`
        return line ? `<p>${escaped}</p>` : ``
      }).join(``)
      return { html, readingTime: null, engine: `fallback`, degraded: true }
    },
  }
}

import assert from 'node:assert/strict'
import test from 'node:test'
import { createDoocsAdapter } from '../src/index.mjs'

test(`uses the injected doocs renderer without owning a second engine`, () => {
  let received
  const adapter = createDoocsAdapter({
    initRenderer: options => ({ options }),
    renderMarkdown: (raw, renderer) => {
      received = { raw, renderer }
      return { html: `<p>rendered</p>`, readingTime: { minutes: 1 } }
    },
  })
  const result = adapter.render(`# Hello`)
  assert.equal(adapter.engine, `doocs/md`)
  assert.equal(adapter.degraded, false)
  assert.equal(result.html, `<p>rendered</p>`)
  assert.equal(received.raw, `# Hello`)
  assert.equal(received.renderer.options.isMacCodeBlock, true)
})

test(`falls back explicitly when doocs is not available`, () => {
  const adapter = createDoocsAdapter()
  const result = adapter.render(`# Hello\n\nWorld`)
  assert.equal(adapter.degraded, true)
  assert.match(result.html, /<h1>Hello<\/h1>/)
})

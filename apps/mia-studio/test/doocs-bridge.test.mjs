import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { transformReadingTime } from '../src/doocs/reading-time-transform.mjs'

test(`replaces doocs reading-time blockquote with compact WeChat-safe HTML`, async () => {
  const rendererFile = new URL(`../../../vendor/doocs-md/packages/core/src/renderer/renderer-impl.ts`, import.meta.url)
  const source = await readFile(rendererFile, `utf8`)
  const transformed = transformReadingTime(source)

  assert.match(transformed, /<section class="md-reading-time" style="[^"]*min-height:0/)
  assert.match(transformed, /class="md-reading-time-p" style="[^"]*margin:0/)
  assert.doesNotMatch(transformed, /<blockquote class="md-blockquote">/)
})

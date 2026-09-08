import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { buildCoverPrompt } from '../src/doocs/cover-prompt.mjs'
import { transformReadingTime } from '../src/doocs/reading-time-transform.mjs'

test(`replaces doocs reading-time blockquote with compact WeChat-safe HTML`, async () => {
  const rendererFile = new URL(`../../../vendor/doocs-md/packages/core/src/renderer/renderer-impl.ts`, import.meta.url)
  const source = await readFile(rendererFile, `utf8`)
  const transformed = transformReadingTime(source)

  assert.match(transformed, /<section class="md-reading-time" style="[^"]*min-height:0/)
  assert.match(transformed, /class="md-reading-time-p" style="[^"]*margin:0/)
  assert.doesNotMatch(transformed, /<blockquote class="md-blockquote">/)
})

test(`builds a fixed-format cover prompt from the current article`, () => {
  const prompt = buildCoverPrompt({
    title: `给女儿做一个本地 AI 玩具`,
    summary: `一次真实的亲子实验`,
    content: `# 开始\n\n![桌面装置](assets/device.png)\n\n我们试了三次，第一次失败了。`,
    direction: `人物不露脸`,
  })

  assert.match(prompt, /900×383/)
  assert.match(prompt, /主体和关键视觉放在中央安全区/)
  assert.match(prompt, /标题：给女儿做一个本地 AI 玩具/)
  assert.match(prompt, /桌面装置/)
  assert.match(prompt, /人物不露脸/)
  assert.doesNotMatch(prompt, /assets\/device\.png/)
})

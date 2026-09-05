import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createMiaServer } from '../../../apps/mia-api/src/server.mjs'
import { pushArticle } from '../src/remote-push.mjs'

test(`pushes a Markdown draft and updates the same Studio article`, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), `mia-cli-push-test-`))
  const apiToken = `test-api-token`
  const server = await createMiaServer({
    vaultRoot: root,
    adminPassword: `test-password`,
    sessionSecret: `test-session-secret`,
    apiToken,
    secureCookies: false,
  })
  await new Promise(resolve => server.listen(0, `127.0.0.1`, resolve))
  const apiUrl = `http://127.0.0.1:${server.address().port}`

  try {
    const created = await pushArticle({
      apiUrl,
      apiToken,
      content: `# 第一版标题\n\n来自 Agent 的草稿。\n`,
    })
    assert.match(created.id, /^article-/)
    assert.equal(created.frontmatter.title, `第一版标题`)
    assert.match(created.content, /来自 Agent 的草稿。/)

    const updated = await pushArticle({
      apiUrl,
      apiToken,
      content: `---\nid: "${created.id}"\ntitle: "排版前的最终标题"\nsummary: "一句摘要"\n---\n# 正文\n\n来自 Obsidian 的第二版。\n`,
    })
    assert.equal(updated.id, created.id)
    assert.equal(updated.frontmatter.title, `排版前的最终标题`)
    assert.equal(updated.frontmatter.summary, `一句摘要`)
    assert.equal(updated.frontmatter.status, `drafting`)
    assert.equal(updated.frontmatter.revision, 2)
    assert.match(updated.content, /来自 Obsidian 的第二版。/)
  }
  finally {
    await new Promise(resolve => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})

test(`requires an API token before sending a draft`, async () => {
  await assert.rejects(
    pushArticle({ content: `# 草稿\n` }),
    error => error.code === `missing_api_token`,
  )
})

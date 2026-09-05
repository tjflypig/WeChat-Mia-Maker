import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createMiaServer } from '../src/server.mjs'

test(`serves authenticated article APIs and rejects stale writes`, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), `mia-api-test-`))
  const server = await createMiaServer({
    vaultRoot: root,
    adminPassword: `test-password`,
    sessionSecret: `test-session-secret`,
    secureCookies: false,
  })

  await new Promise(resolve => server.listen(0, `127.0.0.1`, resolve))
  const address = server.address()
  const base = `http://127.0.0.1:${address.port}`

  try {
    assert.equal((await fetch(`${base}/v1/health`)).status, 200)
    assert.equal((await fetch(`${base}/v1/articles`)).status, 401)

    const login = await fetch(`${base}/v1/auth/login`, {
      method: `POST`,
      headers: { 'content-type': `application/json` },
      body: JSON.stringify({ password: `test-password` }),
    })
    assert.equal(login.status, 200)
    const cookie = login.headers.get(`set-cookie`).split(`;`)[0]

    const createdResponse = await fetch(`${base}/v1/articles`, {
      method: `POST`,
      headers: { 'content-type': `application/json`, cookie },
      body: JSON.stringify({
        id: `doocs-cloud-document-01`,
        title: `API \u521b\u5efa\u7684\u6587\u7ae0`,
        body: `# Doocs \u6b63\u6587\n`,
      }),
    })
    assert.equal(createdResponse.status, 201)
    const created = await createdResponse.json()
    assert.equal(created.id, `doocs-cloud-document-01`)
    assert.match(created.content, /# Doocs \u6b63\u6587/)
    const originalEtag = created.etag

    const savedResponse = await fetch(`${base}/v1/articles/${created.id}`, {
      method: `PUT`,
      headers: { 'content-type': `application/json`, cookie, 'if-match': `"${originalEtag}"` },
      body: JSON.stringify({ content: created.content.replace(`\n\n`, `\n\n\u66f4\u65b0\n`) }),
    })
    assert.equal(savedResponse.status, 200)

    const conflictResponse = await fetch(`${base}/v1/articles/${created.id}`, {
      method: `PUT`,
      headers: { 'content-type': `application/json`, cookie, 'if-match': `"${originalEtag}"` },
      body: JSON.stringify({ content: created.content }),
    })
    assert.equal(conflictResponse.status, 409)
    assert.equal((await conflictResponse.json()).error.code, `conflict`)
  }
  finally {
    await new Promise(resolve => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})

test(`publishes the confirmed doocs rendered HTML snapshot`, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), `mia-publish-test-`))
  const calls = []
  const server = await createMiaServer({
    vaultRoot: root,
    adminPassword: `test-password`,
    sessionSecret: `test-session-secret`,
    secureCookies: false,
    publisher: {
      async publishHtml(options) {
        calls.push(options)
        options.log(`HTML snapshot accepted`)
        return { media_id: `wechat-draft-media-id`, title: options.title, author: options.author || `` }
      },
    },
  })
  await new Promise(resolve => server.listen(0, `127.0.0.1`, resolve))
  const base = `http://127.0.0.1:${server.address().port}`

  try {
    const login = await fetch(`${base}/v1/auth/login`, {
      method: `POST`,
      headers: { 'content-type': `application/json` },
      body: JSON.stringify({ password: `test-password` }),
    })
    const cookie = login.headers.get(`set-cookie`).split(`;`)[0]
    const createdResponse = await fetch(`${base}/v1/articles`, {
      method: `POST`,
      headers: { 'content-type': `application/json`, cookie },
      body: JSON.stringify({ title: `HTML 发布测试`, body: `# Markdown 不应发给微信\n` }),
    })
    const article = await createdResponse.json()
    const html = `<section style="color:#123456"><p>doocs 最终排版</p></section>`
    const preflightResponse = await fetch(`${base}/v1/articles/${article.id}/publish/preflight`, {
      method: `POST`,
      headers: { 'content-type': `application/json`, cookie, 'if-match': `"${article.etag}"` },
      body: JSON.stringify({ html, title: `最终标题` }),
    })
    assert.equal(preflightResponse.status, 200)
    const preflight = await preflightResponse.json()
    assert.equal(preflight.revision, 1)
    assert.equal(preflight.imageCount, 0)

    const confirmResponse = await fetch(`${base}/v1/articles/${article.id}/publish/confirm`, {
      method: `POST`,
      headers: { 'content-type': `application/json`, cookie },
      body: JSON.stringify({ confirmationId: preflight.confirmationId }),
    })
    assert.equal(confirmResponse.status, 200)
    const confirmed = await confirmResponse.json()
    assert.equal(confirmed.media_id, `wechat-draft-media-id`)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].html, html)
    assert.equal(calls[0].title, `最终标题`)
    assert.doesNotMatch(calls[0].html, /Markdown 不应发给微信/)
    assert.equal(confirmed.receipt.mediaId, `wechat-draft-media-id`)

    const receiptsResponse = await fetch(`${base}/v1/articles/${article.id}/publish/receipts`, {
      headers: { cookie },
    })
    assert.equal(receiptsResponse.status, 200)
    const receipts = (await receiptsResponse.json()).receipts
    assert.equal(receipts.length, 1)
    assert.equal(receipts[0].snapshotHash, preflight.snapshotHash)
    assert.equal(receipts[0].artifacts.renderedHtml, `rendered.html`)

    const replay = await fetch(`${base}/v1/articles/${article.id}/publish/confirm`, {
      method: `POST`,
      headers: { 'content-type': `application/json`, cookie },
      body: JSON.stringify({ confirmationId: preflight.confirmationId }),
    })
    assert.equal(replay.status, 410)
    assert.equal(calls.length, 1)
  }
  finally {
    await new Promise(resolve => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  }
})

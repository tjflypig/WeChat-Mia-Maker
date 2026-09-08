import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  archiveArticle,
  createArticle,
  createTopic,
  getArticle,
  getArticleAsset,
  getTopic,
  initVault,
  listArticles,
  listTopics,
  promoteTopic,
  recordPublishReceipt,
  saveArticle,
  storeArticleAsset,
  VAULT_SCHEMA_VERSION,
  WorkspaceError,
} from '../src/index.mjs'

async function withVault(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), `mia-vault-test-`))
  try { await run(root) }
  finally { await rm(root, { recursive: true, force: true }) }
}

test(`initializes the expected schema`, () => withVault(async (root) => {
  const result = await initVault(root)
  assert.equal(result.schemaVersion, VAULT_SCHEMA_VERSION)
  assert.equal((await readFile(path.join(root, `.mia/schema-version`), `utf8`)).trim(), `1`)
}))

test(`records immutable Markdown, rendered HTML and WeChat receipt artifacts`, () => withVault(async (root) => {
  const article = await createArticle(root, { title: `发布归档测试`, body: `# Markdown 源稿\n` })
  const html = `<section><p>doocs 渲染稿</p></section>`
  const receipt = await recordPublishReceipt(root, article.id, {
    renderedHtml: html,
    snapshotHash: `fixed-hash`,
    revision: 1,
    result: { media_id: `wechat-media-id`, title: `发布归档测试` },
    logs: [`draft/add ok`],
    now: new Date(`2026-09-05T12:34:56.000Z`),
  })
  const articleDirectory = path.dirname(article.file)
  const receiptDirectory = path.join(articleDirectory, `publish`, receipt.receiptId)
  assert.equal(await readFile(path.join(receiptDirectory, `source.md`), `utf8`), article.content)
  assert.equal(await readFile(path.join(receiptDirectory, `rendered.html`), `utf8`), html)
  assert.equal(JSON.parse(await readFile(path.join(receiptDirectory, `receipt.json`), `utf8`)).mediaId, `wechat-media-id`)
  assert.deepEqual((await readdir(receiptDirectory)).sort(), [`receipt.json`, `rendered.html`, `source.md`])
}))

test(`stores article images inside the article asset directory`, () => withVault(async (root) => {
  const article = await createArticle(root, { title: `图片测试` })
  const image = Buffer.from([0x89, 0x50, 0x4E, 0x47])
  const stored = await storeArticleAsset(root, article.id, image, {
    contentType: `image/png`,
    originalName: `封面 图.png`,
  })
  assert.match(stored.filename, /^\d{14}-[a-f0-9]{8}\.png$/)
  const loaded = await getArticleAsset(root, article.id, stored.filename)
  assert.deepEqual(loaded.data, image)
  assert.equal(loaded.contentType, `image/png`)
  await assert.rejects(
    storeArticleAsset(root, article.id, Buffer.from(`<svg/>`), { contentType: `image/svg+xml` }),
    error => error instanceof WorkspaceError && error.code === `unsupported_asset_type`,
  )
}))

test(`creates, lists and promotes a topic`, () => withVault(async (root) => {
  const topic = await createTopic(root, { title: `\u7ed9\u5973\u513f\u505a\u4e00\u4e2a\u672c\u5730 AI \u73a9\u5177` })
  assert.match(topic.id, /^topic-/)
  assert.equal((await listTopics(root))[0].status, `candidate`)

  const article = await promoteTopic(root, topic.id)
  assert.match(article.id, /^article-/)
  assert.equal((await getTopic(root, topic.id)).frontmatter.promoted_to, article.id)
  assert.equal((await promoteTopic(root, topic.id)).id, article.id)
}))

test(`protects article updates with an ETag`, () => withVault(async (root) => {
  const article = await createArticle(root, { title: `\u7b2c\u4e00\u7bc7\u6587\u7ae0` })
  const changed = article.content.replace(`\n\n`, `\n\n\u65b0\u6b63\u6587\n`)
  const saved = await saveArticle(root, article.id, changed, { ifMatch: article.etag })
  assert.equal(saved.frontmatter.revision, 2)
  assert.match(saved.content, /\u65b0\u6b63\u6587/)
  assert.equal((await listArticles(root)).length, 1)

  await assert.rejects(
    saveArticle(root, article.id, changed, { ifMatch: article.etag }),
    error => error instanceof WorkspaceError && error.code === `conflict`,
  )
  assert.equal((await getArticle(root, article.id)).etag, saved.etag)
}))

test(`archives an article with ETag protection and removes it from the active list`, () => withVault(async (root) => {
  const article = await createArticle(root, { title: `可恢复归档` })

  await assert.rejects(
    archiveArticle(root, article.id, { ifMatch: `stale-etag` }),
    error => error instanceof WorkspaceError && error.code === `conflict`,
  )

  const archived = await archiveArticle(root, article.id, {
    ifMatch: article.etag,
    now: new Date(`2026-09-08T08:30:00.000Z`),
  })
  assert.equal(archived.frontmatter.status, `archived`)
  assert.equal(archived.frontmatter.archived_at, `2026-09-08T08:30:00.000Z`)
  assert.match(archived.frontmatter.archived_from, /^30-articles\//)
  assert.equal((await listArticles(root)).length, 0)
  await assert.rejects(
    getArticle(root, article.id),
    error => error instanceof WorkspaceError && error.code === `not_found`,
  )
  assert.equal((await readdir(path.join(root, `90-archive`, `articles`))).length, 1)
}))

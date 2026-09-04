import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  createArticle,
  createTopic,
  getArticle,
  getTopic,
  initVault,
  listArticles,
  listTopics,
  promoteTopic,
  saveArticle,
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

import { createHash, randomUUID } from 'node:crypto'
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  stat,
  unlink,
} from 'node:fs/promises'
import path from 'node:path'

export const VAULT_SCHEMA_VERSION = 1

const AREAS = Object.freeze({
  inbox: `00-inbox`,
  topics: `10-topics`,
  materials: `20-materials`,
  articles: `30-articles`,
  references: `40-references`,
  archive: `90-archive`,
  meta: `.mia`,
})

export class WorkspaceError extends Error {
  constructor(code, message, details) {
    super(message)
    this.name = `WorkspaceError`
    this.code = code
    this.details = details
  }
}

function nowIso(now = new Date()) {
  return now.toISOString()
}

function dayStamp(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

function compactStamp(now = new Date()) {
  return now.toISOString().replace(/[-:TZ.]/g, ``).slice(0, 14)
}

export function contentEtag(content) {
  return `sha256:${createHash(`sha256`).update(content).digest(`hex`)}`
}

export function slugify(input) {
  const slug = String(input)
    .normalize(`NFKC`)
    .toLowerCase()
    .replace(/[\\/:*?"<>|]+/g, `-`)
    .replace(/[^\p{L}\p{N}]+/gu, `-`)
    .replace(/^-+|-+$/g, ``)
    .slice(0, 64)
  return slug || `untitled`
}

function scalar(value) {
  if (value === null)
    return `null`
  if (typeof value === `boolean` || typeof value === `number`)
    return String(value)
  return JSON.stringify(String(value))
}

function parseScalar(value) {
  const input = value.trim()
  if (input === `null` || input === `~`)
    return null
  if (input === `true`)
    return true
  if (input === `false`)
    return false
  if (/^-?\d+(?:\.\d+)?$/.test(input))
    return Number(input)
  if ((input.startsWith(`"`) && input.endsWith(`"`)) || (input.startsWith(`'`) && input.endsWith(`'`))) {
    if (input.startsWith(`"`)) {
      try { return JSON.parse(input) }
      catch { return input.slice(1, -1) }
    }
    return input.slice(1, -1).replace(/''/g, `'`)
  }
  return input
}

export function splitFrontmatter(content) {
  const normalized = String(content).replace(/\r\n/g, `\n`)
  if (!normalized.startsWith(`---\n`))
    return { lines: [], body: normalized, hasFrontmatter: false }
  const end = normalized.indexOf(`\n---\n`, 4)
  if (end === -1)
    return { lines: [], body: normalized, hasFrontmatter: false }
  return {
    lines: normalized.slice(4, end).split(`\n`),
    body: normalized.slice(end + 5),
    hasFrontmatter: true,
  }
}

export function parseFrontmatter(content) {
  const { lines } = splitFrontmatter(content)
  const result = {}
  for (const line of lines) {
    if (/^\s/.test(line) || line.trim().startsWith(`#`))
      continue
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/)
    if (match)
      result[match[1]] = parseScalar(match[2])
  }
  return result
}

export function patchFrontmatter(content, changes) {
  const split = splitFrontmatter(content)
  const lines = split.hasFrontmatter ? [...split.lines] : []
  const pending = new Map(Object.entries(changes))

  for (let index = 0; index < lines.length; index++) {
    if (/^\s/.test(lines[index]))
      continue
    const match = lines[index].match(/^([A-Za-z_][A-Za-z0-9_-]*):/)
    if (!match || !pending.has(match[1]))
      continue
    lines[index] = `${match[1]}: ${scalar(pending.get(match[1]))}`
    pending.delete(match[1])
  }

  for (const [key, value] of pending)
    lines.push(`${key}: ${scalar(value)}`)

  const body = split.hasFrontmatter ? split.body : String(content)
  return `---\n${lines.join(`\n`)}\n---\n${body.replace(/^\n+/, ``)}`
}

async function exists(file) {
  try {
    await stat(file)
    return true
  }
  catch (error) {
    if (error?.code === `ENOENT`)
      return false
    throw error
  }
}

export async function atomicWrite(file, content) {
  await mkdir(path.dirname(file), { recursive: true })
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`)
  try {
    const handle = await open(temporary, `wx`, 0o600)
    try {
      await handle.writeFile(content, typeof content === `string` ? `utf8` : undefined)
      await handle.sync()
    }
    finally {
      await handle.close()
    }
    await rename(temporary, file)
  }
  catch (error) {
    await unlink(temporary).catch(cleanupError => {
      if (cleanupError?.code !== `ENOENT`)
        error.cleanupError = cleanupError
    })
    throw error
  }
}

export async function initVault(root) {
  const absoluteRoot = path.resolve(root)
  await Promise.all(Object.values(AREAS).map(area => mkdir(path.join(absoluteRoot, area), { recursive: true })))
  await mkdir(path.join(absoluteRoot, AREAS.materials, `clips`), { recursive: true })
  await mkdir(path.join(absoluteRoot, AREAS.materials, `attachments`), { recursive: true })

  const schemaFile = path.join(absoluteRoot, AREAS.meta, `schema-version`)
  if (!await exists(schemaFile))
    await atomicWrite(schemaFile, `${VAULT_SCHEMA_VERSION}\n`)

  const actual = Number((await readFile(schemaFile, `utf8`)).trim())
  if (actual !== VAULT_SCHEMA_VERSION) {
    throw new WorkspaceError(
      `unsupported_schema`,
      `Vault schema ${actual} is not supported; expected ${VAULT_SCHEMA_VERSION}`,
      { actual, expected: VAULT_SCHEMA_VERSION },
    )
  }

  return { root: absoluteRoot, schemaVersion: actual }
}

async function markdownFiles(directory) {
  if (!await exists(directory))
    return []
  const entries = await readdir(directory, { withFileTypes: true })
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith(`.md`))
    .map(entry => path.join(directory, entry.name))
}

async function articleFiles(root) {
  const directory = path.join(root, AREAS.articles)
  if (!await exists(directory))
    return []
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (!entry.isDirectory())
      continue
    const file = path.join(directory, entry.name, `index.md`)
    if (await exists(file))
      files.push(file)
  }
  return files
}

async function readEntity(file) {
  const content = await readFile(file, `utf8`)
  const frontmatter = parseFrontmatter(content)
  return {
    id: frontmatter.id,
    file,
    content,
    frontmatter,
    etag: contentEtag(content),
  }
}

async function findEntity(root, kind, id) {
  const files = kind === `article`
    ? await articleFiles(root)
    : await markdownFiles(path.join(root, AREAS.topics))
  for (const file of files) {
    const entity = await readEntity(file)
    if (entity.id === id)
      return entity
  }
  throw new WorkspaceError(`not_found`, `${kind} not found: ${id}`, { kind, id })
}

function entitySummary(entity) {
  return {
    id: entity.id,
    title: entity.frontmatter.title || entity.id,
    status: entity.frontmatter.status || `unknown`,
    updatedAt: entity.frontmatter.updated_at || null,
    etag: entity.etag,
  }
}

export async function listTopics(root, { status } = {}) {
  await initVault(root)
  const entities = await Promise.all((await markdownFiles(path.join(root, AREAS.topics))).map(readEntity))
  return entities
    .filter(entity => !status || entity.frontmatter.status === status)
    .map(entitySummary)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function createTopic(root, { title, source = `manual`, pillar = `unassigned`, now = new Date() }) {
  if (!String(title || ``).trim())
    throw new WorkspaceError(`invalid_title`, `Topic title is required`)
  await initVault(root)
  const slug = slugify(title)
  const id = `topic-${compactStamp(now)}-${randomUUID().slice(0, 8)}`
  const timestamp = nowIso(now)
  const content = `---\nschema_version: ${VAULT_SCHEMA_VERSION}\nid: ${scalar(id)}\nstatus: "candidate"\ntitle: ${scalar(title.trim())}\npillar: ${scalar(pillar)}\nsource: ${scalar(source)}\ncreated_at: ${scalar(timestamp)}\nupdated_at: ${scalar(timestamp)}\npromoted_to: null\n---\n# ${title.trim()}\n\n## \u4e3a\u4ec0\u4e48\u503c\u5f97\u5199\n\n## \u5df2\u6709\u7d20\u6750\n\n## \u8fd8\u7f3a\u4ec0\u4e48\n`
  const file = path.join(root, AREAS.topics, `${id}-${slug}.md`)
  await atomicWrite(file, content)
  return readEntity(file)
}

export async function getTopic(root, id) {
  await initVault(root)
  return findEntity(root, `topic`, id)
}

export async function listArticles(root, { status } = {}) {
  await initVault(root)
  const entities = await Promise.all((await articleFiles(root)).map(readEntity))
  return entities
    .filter(entity => !status || entity.frontmatter.status === status)
    .map(entitySummary)
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

export async function createArticle(root, { title, topicId = null, id: requestedId = null, body = null, now = new Date() }) {
  if (!String(title || ``).trim())
    throw new WorkspaceError(`invalid_title`, `Article title is required`)
  await initVault(root)
  const slug = slugify(title)
  const id = requestedId ? String(requestedId) : `article-${compactStamp(now)}-${randomUUID().slice(0, 8)}`
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,127}$/.test(id))
    throw new WorkspaceError(`invalid_id`, `Article id is invalid`)
  if ((await listArticles(root)).some(article => article.id === id))
    throw new WorkspaceError(`conflict`, `Article already exists: ${id}`)
  const timestamp = nowIso(now)
  let directory = path.join(root, AREAS.articles, `${dayStamp(now)}-${slug}`)
  let suffix = 2
  while (await exists(directory))
    directory = path.join(root, AREAS.articles, `${dayStamp(now)}-${slug}-${suffix++}`)

  await mkdir(path.join(directory, `assets`), { recursive: true })
  await mkdir(path.join(directory, `reports`), { recursive: true })
  await mkdir(path.join(directory, `publish`), { recursive: true })

  const articleBody = body == null ? `# ${title.trim()}\n\n` : String(body)
  const content = `---\nschema_version: ${VAULT_SCHEMA_VERSION}\nid: ${scalar(id)}\ntopic_id: ${scalar(topicId)}\ntitle: ${scalar(title.trim())}\nstatus: "drafting"\nauthor: ""\nsummary: ""\ncover: ""\ntheme: "mia-life-lab"\ncreated_at: ${scalar(timestamp)}\nupdated_at: ${scalar(timestamp)}\nrevision: 1\n---\n${articleBody}`
  const file = path.join(directory, `index.md`)
  await atomicWrite(file, content)
  return readEntity(file)
}

export async function getArticle(root, id) {
  await initVault(root)
  return findEntity(root, `article`, id)
}

const IMAGE_EXTENSIONS = Object.freeze({
  'image/jpeg': `jpg`,
  'image/png': `png`,
  'image/gif': `gif`,
  'image/webp': `webp`,
})

export async function storeArticleAsset(root, id, data, { contentType } = {}) {
  const article = await getArticle(root, id)
  const extension = IMAGE_EXTENSIONS[String(contentType || ``).toLowerCase()]
  if (!extension)
    throw new WorkspaceError(`unsupported_asset_type`, `Only JPEG, PNG, GIF and WebP images are supported`)
  if (!Buffer.isBuffer(data) || data.length === 0)
    throw new WorkspaceError(`empty_asset`, `Image file is empty`)

  const filename = `${compactStamp()}-${randomUUID().slice(0, 8)}.${extension}`
  await atomicWrite(path.join(path.dirname(article.file), `assets`, filename), data)
  return { filename, contentType: String(contentType).toLowerCase(), bytes: data.length }
}

export async function getArticleAsset(root, id, filename) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,159}$/.test(String(filename)))
    throw new WorkspaceError(`invalid_asset_name`, `Asset filename is invalid`)
  const article = await getArticle(root, id)
  const file = path.join(path.dirname(article.file), `assets`, filename)
  if (!await exists(file))
    throw new WorkspaceError(`not_found`, `Asset not found: ${filename}`, { id, filename })
  const extension = path.extname(filename).slice(1).toLowerCase()
  const contentType = Object.entries(IMAGE_EXTENSIONS).find(([, ext]) => ext === extension)?.[0] || `application/octet-stream`
  return { data: await readFile(file), contentType }
}

export async function saveArticle(root, id, content, { ifMatch, now = new Date() } = {}) {
  const current = await getArticle(root, id)
  if (!ifMatch)
    throw new WorkspaceError(`precondition_required`, `If-Match is required`, { currentEtag: current.etag })
  if (ifMatch !== current.etag)
    throw new WorkspaceError(`conflict`, `Article changed since it was opened`, { currentEtag: current.etag })

  const incoming = parseFrontmatter(content)
  if (incoming.id && incoming.id !== id)
    throw new WorkspaceError(`id_mismatch`, `Article id cannot be changed`, { expected: id, actual: incoming.id })

  const revision = Number(current.frontmatter.revision || 0) + 1
  const updated = patchFrontmatter(content, {
    schema_version: VAULT_SCHEMA_VERSION,
    id,
    updated_at: nowIso(now),
    revision,
  })
  await atomicWrite(current.file, updated)
  return readEntity(current.file)
}

export async function archiveArticle(root, id, { ifMatch, now = new Date() } = {}) {
  const current = await getArticle(root, id)
  if (!ifMatch)
    throw new WorkspaceError(`precondition_required`, `If-Match is required`, { currentEtag: current.etag })
  if (ifMatch !== current.etag)
    throw new WorkspaceError(`conflict`, `Article changed since it was opened`, { currentEtag: current.etag })

  const archivedAt = nowIso(now)
  const sourceDirectory = path.dirname(current.file)
  const archiveRoot = path.join(root, AREAS.archive, `articles`)
  const archiveDirectory = path.join(
    archiveRoot,
    `${compactStamp(now)}-${path.basename(sourceDirectory)}-${randomUUID().slice(0, 8)}`,
  )
  const archivedContent = patchFrontmatter(current.content, {
    status: `archived`,
    archived_at: archivedAt,
    archived_from: `${AREAS.articles}/${path.basename(sourceDirectory)}`,
    updated_at: archivedAt,
    revision: Number(current.frontmatter.revision || 0) + 1,
  })

  await mkdir(archiveRoot, { recursive: true })
  await rename(sourceDirectory, archiveDirectory)
  await atomicWrite(path.join(archiveDirectory, `index.md`), archivedContent)
  return readEntity(path.join(archiveDirectory, `index.md`))
}

export async function recordPublishReceipt(root, id, {
  renderedHtml,
  snapshotHash,
  revision,
  result,
  logs = [],
  now = new Date(),
} = {}) {
  const article = await getArticle(root, id)
  if (!String(renderedHtml || ``).trim())
    throw new WorkspaceError(`empty_rendered_html`, `Rendered HTML is required`)

  const receiptId = `publish-${compactStamp(now)}-${randomUUID().slice(0, 8)}`
  const directory = path.join(path.dirname(article.file), `publish`, receiptId)
  const publishedAt = nowIso(now)
  const receipt = {
    schemaVersion: 1,
    receiptId,
    articleId: article.id,
    revision: Number(revision || article.frontmatter.revision || 0),
    articleEtag: article.etag,
    snapshotHash: String(snapshotHash || createHash(`sha256`).update(renderedHtml).digest(`hex`)),
    publishedAt,
    mediaId: result?.media_id || null,
    title: result?.title || article.frontmatter.title || article.id,
    author: result?.author || article.frontmatter.author || ``,
    logs: logs.map(String),
    artifacts: {
      markdown: `source.md`,
      renderedHtml: `rendered.html`,
    },
  }

  await mkdir(directory, { recursive: true })
  await Promise.all([
    atomicWrite(path.join(directory, receipt.artifacts.markdown), article.content),
    atomicWrite(path.join(directory, receipt.artifacts.renderedHtml), String(renderedHtml)),
    atomicWrite(path.join(directory, `receipt.json`), `${JSON.stringify(receipt, null, 2)}\n`),
  ])
  return receipt
}

export async function listPublishReceipts(root, id) {
  const article = await getArticle(root, id)
  const directory = path.join(path.dirname(article.file), `publish`)
  if (!await exists(directory))
    return []
  const entries = await readdir(directory, { withFileTypes: true })
  const receipts = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(`publish-`))
      continue
    try {
      receipts.push(JSON.parse(await readFile(path.join(directory, entry.name, `receipt.json`), `utf8`)))
    }
    catch (error) {
      if (error?.code !== `ENOENT`)
        throw error
    }
  }
  return receipts.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
}

export async function promoteTopic(root, id, { now = new Date() } = {}) {
  const topic = await getTopic(root, id)
  if (topic.frontmatter.promoted_to)
    return getArticle(root, topic.frontmatter.promoted_to)
  const article = await createArticle(root, { title: topic.frontmatter.title, topicId: id, now })
  const updatedTopic = patchFrontmatter(topic.content, {
    status: `drafting`,
    promoted_to: article.id,
    updated_at: nowIso(now),
  })
  await atomicWrite(topic.file, updatedTopic)
  return article
}

export function publicEntity(entity) {
  return {
    id: entity.id,
    content: entity.content,
    frontmatter: entity.frontmatter,
    etag: entity.etag,
  }
}

import type { Post } from '@/types/post'
import { toast } from '@/lib/toast'

type Article = {
  id: string
  content: string
  etag: string
  frontmatter: Record<string, unknown>
}

const frontmatterById = new Map<string, string>()
const etagById = new Map<string, string>()
const syncedContentById = new Map<string, string>()
let cachedPosts: Post[] | null = null
let writeQueue: Promise<void> = Promise.resolve()

function splitDocument(content: string) {
  const match = String(content).match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/)
  return match ? { frontmatter: match[1], body: match[2] } : { frontmatter: ``, body: String(content) }
}

function titleIn(frontmatter: string, title: string) {
  const line = `title: ${JSON.stringify(title)}`
  return /^title:.*$/m.test(frontmatter)
    ? frontmatter.replace(/^title:.*$/m, line)
    : frontmatter
}

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(`/v1${path}`, {
    credentials: `same-origin`,
    ...options,
    headers: {
      ...(options.body ? { 'content-type': `application/json` } : {}),
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = Object.assign(new Error(body?.error?.message || `请求失败 (${response.status})`), {
      status: response.status,
      code: body?.error?.code,
    })
    throw error
  }
  return {
    body,
    etag: response.headers.get(`etag`)?.replace(/^"|"$/g, ``) || body.etag || ``,
  }
}

function toPost(article: Article): Post {
  const { frontmatter, body } = splitDocument(article.content)
  frontmatterById.set(article.id, frontmatter)
  etagById.set(article.id, article.etag)
  syncedContentById.set(article.id, article.content)
  const created = String(article.frontmatter.created_at || Date.now())
  const updated = String(article.frontmatter.updated_at || created)
  return {
    id: article.id,
    title: String(article.frontmatter.title || article.id),
    content: body,
    history: [{ datetime: new Date(updated).getTime(), content: body }],
    createDatetime: new Date(created),
    updateDatetime: new Date(updated),
  }
}

function serialize(post: Post) {
  return `${titleIn(frontmatterById.get(post.id) || ``, post.title)}${post.content}`
}

function updateCache(post: Post) {
  if (!cachedPosts)
    return
  const index = cachedPosts.findIndex(item => item.id === post.id)
  if (index === -1)
    cachedPosts.push(post)
  else
    cachedPosts[index] = post
}

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(task, task)
  writeQueue = next.then(() => {}, () => {})
  return next
}

async function saveCloudPost(post: Post) {
  const knownFrontmatter = frontmatterById.get(post.id)
  if (!knownFrontmatter) {
    const { body, etag } = await api(`/articles`, {
      method: `POST`,
      body: JSON.stringify({ id: post.id, title: post.title, body: post.content }),
    })
    const article = { ...body, etag } as Article
    const parts = splitDocument(article.content)
    frontmatterById.set(post.id, parts.frontmatter)
    etagById.set(post.id, article.etag)
    syncedContentById.set(post.id, article.content)
    updateCache(post)
    return
  }

  const content = serialize(post)
  if (content === syncedContentById.get(post.id))
    return

  const currentEtag = etagById.get(post.id)
  if (!currentEtag)
    throw new Error(`缺少文章版本标识，请刷新后重试`)
  const { body, etag } = await api(`/articles/${encodeURIComponent(post.id)}`, {
    method: `PUT`,
    headers: { 'if-match': `"${currentEtag}"` },
    body: JSON.stringify({ content }),
  })
  const article = { ...body, etag } as Article
  frontmatterById.set(post.id, splitDocument(article.content).frontmatter)
  etagById.set(post.id, article.etag)
  syncedContentById.set(post.id, article.content)
  updateCache(post)
}

export function setUseLegacyDocumentStorage(_enabled: boolean): void {}
export function isUsingLegacyDocumentStorage(): boolean { return false }
export function getLoadedDocuments(): Post[] | null { return cachedPosts }
export function clearDocumentCache(): void { cachedPosts = null }
export function getArticleSyncInfo(id: string) {
  return {
    etag: etagById.get(id) || ``,
    metadata: splitDocument(syncedContentById.get(id) || ``).frontmatter,
  }
}

export const documentRepo = {
  async loadAll(): Promise<Post[]> {
    if (cachedPosts)
      return cachedPosts
    const { body } = await api(`/articles`)
    const articles = await Promise.all(
      body.articles.map((item: { id: string }) => api(`/articles/${encodeURIComponent(item.id)}`).then(result => ({ ...result.body, etag: result.etag }))),
    )
    cachedPosts = articles.map(toPost)
    return cachedPosts
  },

  async savePost(post: Post): Promise<void> {
    return serialized(async () => {
      try {
        await saveCloudPost(post)
      }
      catch (error) {
        const message = (error as Error & { code?: string }).code === `conflict`
          ? `云端文章已被其他终端修改，当前编辑内容仍保留，请刷新后核对。`
          : `保存到腾讯云失败：${(error as Error).message}`
        toast.error(message)
        throw error
      }
    })
  },

  async saveAll(posts: Post[]): Promise<void> {
    for (const post of posts)
      await this.savePost(post)
    cachedPosts = [...posts]
  },

  async deletePost(_id: string): Promise<void> {},

  async clear(): Promise<void> {
    cachedPosts = []
    frontmatterById.clear()
    etagById.clear()
    syncedContentById.clear()
  },
}

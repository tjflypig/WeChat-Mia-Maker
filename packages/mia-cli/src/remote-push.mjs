import {
  parseFrontmatter,
  patchFrontmatter,
  splitFrontmatter,
} from '@mia/workspace'

export class MiaApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = `MiaApiError`
    this.status = status
    this.code = code
    this.details = details
  }
}

function endpoint(apiUrl, pathname) {
  return `${String(apiUrl).replace(/\/+$/, ``)}/v1${pathname}`
}

async function request(apiUrl, apiToken, pathname, options = {}) {
  let response
  try {
    response = await fetch(endpoint(apiUrl, pathname), {
      ...options,
      headers: {
        authorization: `Bearer ${apiToken}`,
        ...(options.body ? { 'content-type': `application/json` } : {}),
        ...options.headers,
      },
    })
  }
  catch (error) {
    throw new MiaApiError(0, `api_unreachable`, `无法连接 Mia API：${error.message}`)
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new MiaApiError(
      response.status,
      body?.error?.code || `request_failed`,
      body?.error?.message || `Mia API request failed (${response.status})`,
      body?.error?.details,
    )
  }
  return body
}

export async function fetchArticle({
  apiUrl = `http://127.0.0.1:8787`,
  apiToken,
  id,
}) {
  if (!apiToken)
    throw new MiaApiError(0, `missing_api_token`, `MIA_API_TOKEN or --token is required`)
  if (!id)
    throw new MiaApiError(0, `missing_article_id`, `Article id is required`)
  return request(apiUrl, apiToken, `/articles/${encodeURIComponent(id)}`)
}

function titleFrom(content, preferred, fallback) {
  const metadata = parseFrontmatter(content)
  const heading = splitFrontmatter(content).body.match(/^#\s+(.+)$/m)?.[1]
  return String(preferred || metadata.title || heading || fallback || `未命名文章`).trim()
}

function mergeSource(currentContent, sourceContent, id) {
  const source = splitFrontmatter(sourceContent)
  const sourceMetadata = parseFrontmatter(sourceContent)
  const editableMetadata = Object.fromEntries(
    Object.entries(sourceMetadata).filter(([key]) => ![
      `schema_version`,
      `id`,
      `created_at`,
      `updated_at`,
      `revision`,
    ].includes(key)),
  )
  const currentFrontmatter = splitFrontmatter(currentContent)
  return patchFrontmatter(
    `${currentFrontmatter.hasFrontmatter ? `---\n${currentFrontmatter.lines.join(`\n`)}\n---\n` : ``}${source.body}`,
    { ...editableMetadata, id },
  )
}

export async function pushArticle({
  apiUrl = `http://127.0.0.1:8787`,
  apiToken,
  content,
  id,
  title,
  fallbackTitle,
}) {
  if (!apiToken)
    throw new MiaApiError(0, `missing_api_token`, `MIA_API_TOKEN or --token is required`)

  const sourceMetadata = parseFrontmatter(content)
  const requestedId = id || sourceMetadata.id || null
  const articleTitle = titleFrom(content, title, fallbackTitle)
  let current = null

  if (requestedId) {
    try {
      current = await request(apiUrl, apiToken, `/articles/${encodeURIComponent(requestedId)}`)
    }
    catch (error) {
      if (!(error instanceof MiaApiError) || error.status !== 404)
        throw error
    }
  }

  if (!current) {
    current = await request(apiUrl, apiToken, `/articles`, {
      method: `POST`,
      body: JSON.stringify({
        id: requestedId || undefined,
        title: articleTitle,
        body: splitFrontmatter(content).body,
      }),
    })
  }

  const mergedContent = mergeSource(current.content, content, current.id)
  if (mergedContent === current.content)
    return current

  return request(apiUrl, apiToken, `/articles/${encodeURIComponent(current.id)}`, {
    method: `PUT`,
    headers: { 'if-match': `"${current.etag}"` },
    body: JSON.stringify({ content: mergedContent }),
  })
}

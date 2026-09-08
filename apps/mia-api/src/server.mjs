import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer as createHttpServer } from 'node:http'
import {
  archiveArticle,
  createArticle,
  createTopic,
  getArticle,
  getArticleAsset,
  initVault,
  listArticles,
  listPublishReceipts,
  listTopics,
  promoteTopic,
  publicEntity,
  recordPublishReceipt,
  saveArticle,
  storeArticleAsset,
  WorkspaceError,
} from '@mia/workspace'

const MAX_BODY_BYTES = 8 * 1024 * 1024
const PUBLISH_CONFIRMATION_TTL_MS = 10 * 60 * 1000

function safeEqual(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}

function passwordDigest(password) {
  return createHash(`sha256`).update(String(password)).digest(`hex`)
}

function signSession(secret, ttlMs) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ttlMs, nonce: randomUUID() })).toString(`base64url`)
  const signature = createHmac(`sha256`, secret).update(payload).digest(`base64url`)
  return `${payload}.${signature}`
}

function verifySession(token, secret) {
  const [payload, signature] = String(token || ``).split(`.`)
  if (!payload || !signature)
    return false
  const expected = createHmac(`sha256`, secret).update(payload).digest(`base64url`)
  if (!safeEqual(signature, expected))
    return false
  try {
    return JSON.parse(Buffer.from(payload, `base64url`).toString(`utf8`)).exp > Date.now()
  }
  catch {
    return false
  }
}

function cookies(req) {
  const result = {}
  for (const pair of String(req.headers.cookie || ``).split(`;`)) {
    const index = pair.indexOf(`=`)
    if (index > 0)
      result[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim())
  }
  return result
}

async function readJson(req) {
  const raw = await readBody(req)
  if (!raw.length)
    return {}
  try { return JSON.parse(raw.toString(`utf8`)) }
  catch { throw Object.assign(new Error(`Invalid JSON body`), { status: 400, code: `invalid_json` }) }
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES)
      throw Object.assign(new Error(`Request body is too large`), { status: 413, code: `body_too_large` })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function json(res, status, body, headers = {}) {
  const raw = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': `application/json; charset=utf-8`,
    'content-length': Buffer.byteLength(raw),
    'cache-control': `no-store`,
    ...headers,
  })
  res.end(raw)
}

function binary(res, status, body, contentType) {
  res.writeHead(status, {
    'content-type': contentType,
    'content-length': body.length,
    'cache-control': `private, max-age=31536000, immutable`,
    'x-content-type-options': `nosniff`,
  })
  res.end(body)
}

function errorResponse(res, error) {
  if (error instanceof WorkspaceError) {
    const status = {
      not_found: 404,
      conflict: 409,
      precondition_required: 428,
    }[error.code] || 400
    return json(res, status, { error: { code: error.code, message: error.message, details: error.details } })
  }
  const status = error.status || 500
  return json(res, status, { error: { code: error.code || `internal_error`, message: status === 500 ? `Internal server error` : error.message } })
}

function match(pathname, expression) {
  const result = pathname.match(expression)
  return result ? result.slice(1).map(decodeURIComponent) : null
}

export async function createMiaServer(options) {
  const {
    vaultRoot,
    adminPassword,
    sessionSecret,
    apiToken = ``,
    publicUrl = ``,
    publisher = null,
    secureCookies = true,
    sessionTtlMs = 30 * 24 * 60 * 60 * 1000,
  } = options

  if (!vaultRoot || !adminPassword || !sessionSecret)
    throw new Error(`vaultRoot, adminPassword and sessionSecret are required`)
  await initVault(vaultRoot)
  const expectedPassword = passwordDigest(adminPassword)
  const pendingPublishes = new Map()

  function assetToken(articleId, filename) {
    return createHmac(`sha256`, sessionSecret).update(`${articleId}/${filename}`).digest(`base64url`)
  }

  function authenticated(req) {
    const bearer = String(req.headers.authorization || ``).replace(/^Bearer\s+/i, ``)
    if (apiToken && safeEqual(bearer, apiToken))
      return true
    return verifySession(cookies(req).mia_session, sessionSecret)
  }

  return createHttpServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || `localhost`}`)
    const { pathname } = url
    try {
      if (pathname === `/v1/health` && req.method === `GET`)
        return json(res, 200, { status: `ok`, apiVersion: 1 })

      const publicAsset = match(pathname, /^\/v1\/articles\/([^/]+)\/assets\/([^/]+)$/)
      if (publicAsset && req.method === `GET`) {
        if (!safeEqual(url.searchParams.get(`token`) || ``, assetToken(publicAsset[0], publicAsset[1])))
          return json(res, 403, { error: { code: `invalid_asset_token`, message: `图片地址无效` } })
        const asset = await getArticleAsset(vaultRoot, publicAsset[0], publicAsset[1])
        return binary(res, 200, asset.data, asset.contentType)
      }

      if (pathname === `/v1/auth/login` && req.method === `POST`) {
        const body = await readJson(req)
        if (!safeEqual(passwordDigest(body.password || ``), expectedPassword))
          return json(res, 401, { error: { code: `invalid_credentials`, message: `\u5bc6\u7801\u9519\u8bef` } })
        const token = signSession(sessionSecret, sessionTtlMs)
        const cookie = `mia_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(sessionTtlMs / 1000)}${secureCookies ? `; Secure` : ``}`
        return json(res, 200, { user: { id: `owner`, name: `Mia` } }, { 'set-cookie': cookie })
      }

      if (pathname === `/v1/auth/logout` && req.method === `POST`)
        return json(res, 200, { ok: true }, { 'set-cookie': `mia_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookies ? `; Secure` : ``}` })

      if (!authenticated(req))
        return json(res, 401, { error: { code: `unauthorized`, message: `\u8bf7\u5148\u767b\u5f55` } })

      if (pathname === `/v1/session` && req.method === `GET`)
        return json(res, 200, { user: { id: `owner`, name: `Mia` } })

      if (pathname === `/v1/topics` && req.method === `GET`)
        return json(res, 200, { topics: await listTopics(vaultRoot, { status: url.searchParams.get(`status`) || undefined }) })

      if (pathname === `/v1/topics` && req.method === `POST`) {
        const topic = await createTopic(vaultRoot, await readJson(req))
        return json(res, 201, publicEntity(topic), { etag: `"${topic.etag}"` })
      }

      const promote = match(pathname, /^\/v1\/topics\/([^/]+)\/promote$/)
      if (promote && req.method === `POST`) {
        const article = await promoteTopic(vaultRoot, promote[0])
        return json(res, 201, publicEntity(article), { etag: `"${article.etag}"` })
      }

      if (pathname === `/v1/articles` && req.method === `GET`)
        return json(res, 200, { articles: await listArticles(vaultRoot, { status: url.searchParams.get(`status`) || undefined }) })

      if (pathname === `/v1/articles` && req.method === `POST`) {
        const body = await readJson(req)
        const article = await createArticle(vaultRoot, {
          title: body.title,
          topicId: body.topicId,
          id: body.id,
          body: body.body,
        })
        return json(res, 201, publicEntity(article), { etag: `"${article.etag}"` })
      }

      const articleRoute = match(pathname, /^\/v1\/articles\/([^/]+)$/)
      if (articleRoute && req.method === `GET`) {
        const article = await getArticle(vaultRoot, articleRoute[0])
        return json(res, 200, publicEntity(article), { etag: `"${article.etag}"` })
      }

      if (articleRoute && req.method === `PUT`) {
        const body = await readJson(req)
        const ifMatch = String(req.headers[`if-match`] || ``).replace(/^"|"$/g, ``)
        const article = await saveArticle(vaultRoot, articleRoute[0], String(body.content || ``), { ifMatch })
        return json(res, 200, publicEntity(article), { etag: `"${article.etag}"` })
      }

      if (articleRoute && req.method === `DELETE`) {
        const ifMatch = String(req.headers[`if-match`] || ``).replace(/^"|"$/g, ``)
        const article = await archiveArticle(vaultRoot, articleRoute[0], { ifMatch })
        return json(res, 200, publicEntity(article), { etag: `"${article.etag}"` })
      }

      const articleAssets = match(pathname, /^\/v1\/articles\/([^/]+)\/assets$/)
      if (articleAssets && req.method === `POST`) {
        const contentType = String(req.headers[`content-type`] || ``).split(`;`)[0].trim().toLowerCase()
        const asset = await storeArticleAsset(vaultRoot, articleAssets[0], await readBody(req), { contentType })
        const forwardedProtocol = String(req.headers[`x-forwarded-proto`] || ``).split(`,`)[0].trim()
        const protocol = forwardedProtocol === `https` ? `https` : `http`
        const host = String(req.headers[`x-forwarded-host`] || req.headers.host || `localhost`).split(`,`)[0].trim()
        const assetPath = `/v1/articles/${encodeURIComponent(articleAssets[0])}/assets/${encodeURIComponent(asset.filename)}`
        const token = assetToken(articleAssets[0], asset.filename)
        const origin = String(publicUrl || `${protocol}://${host}`).replace(/\/+$/, ``)
        return json(res, 201, { ...asset, url: `${origin}${assetPath}?token=${encodeURIComponent(token)}` })
      }

      const publishReceipts = match(pathname, /^\/v1\/articles\/([^/]+)\/publish\/receipts$/)
      if (publishReceipts && req.method === `GET`)
        return json(res, 200, { receipts: await listPublishReceipts(vaultRoot, publishReceipts[0]) })

      const publishPreflight = match(pathname, /^\/v1\/articles\/([^/]+)\/publish\/preflight$/)
      if (publishPreflight && req.method === `POST`) {
        if (!publisher)
          return json(res, 503, { error: { code: `publisher_unavailable`, message: `微信发布服务尚未配置` } })
        const article = await getArticle(vaultRoot, publishPreflight[0])
        const ifMatch = String(req.headers[`if-match`] || ``).replace(/^"|"$/g, ``)
        if (!ifMatch)
          throw new WorkspaceError(`precondition_required`, `If-Match is required`, { currentEtag: article.etag })
        if (ifMatch !== article.etag)
          throw new WorkspaceError(`conflict`, `Article changed before publishing`, { currentEtag: article.etag })
        const body = await readJson(req)
        const html = String(body.html || ``).trim()
        if (!html)
          return json(res, 400, { error: { code: `empty_rendered_html`, message: `渲染后的 HTML 为空` } })
        if (/<script\b/i.test(html))
          return json(res, 400, { error: { code: `unsafe_rendered_html`, message: `渲染 HTML 不允许包含 script` } })

        const confirmationId = randomUUID()
        const snapshotHash = createHash(`sha256`).update(html).digest(`hex`)
        const expiresAt = Date.now() + PUBLISH_CONFIRMATION_TTL_MS
        for (const [id, pending] of pendingPublishes) {
          if (pending.expiresAt <= Date.now() || pending.articleId === article.id)
            pendingPublishes.delete(id)
        }
        const snapshot = {
          articleId: article.id,
          articleEtag: article.etag,
          revision: Number(article.frontmatter.revision || 0),
          html,
          snapshotHash,
          title: String(body.title || article.frontmatter.title || article.id),
          author: String(body.author || article.frontmatter.author || ``),
          cover: String(body.cover || article.frontmatter.cover || ``),
          expiresAt,
        }
        pendingPublishes.set(confirmationId, snapshot)
        return json(res, 200, {
          confirmationId,
          expiresAt: new Date(expiresAt).toISOString(),
          snapshotHash,
          articleId: article.id,
          revision: snapshot.revision,
          title: snapshot.title,
          htmlBytes: Buffer.byteLength(html),
          imageCount: (html.match(/<img\b/gi) || []).length,
        })
      }

      const publishConfirm = match(pathname, /^\/v1\/articles\/([^/]+)\/publish\/confirm$/)
      if (publishConfirm && req.method === `POST`) {
        if (!publisher)
          return json(res, 503, { error: { code: `publisher_unavailable`, message: `微信发布服务尚未配置` } })
        const body = await readJson(req)
        const confirmationId = String(body.confirmationId || ``)
        const snapshot = pendingPublishes.get(confirmationId)
        pendingPublishes.delete(confirmationId)
        if (!snapshot || snapshot.articleId !== publishConfirm[0] || snapshot.expiresAt <= Date.now())
          return json(res, 410, { error: { code: `confirmation_expired`, message: `发布确认已失效，请重新预检` } })
        const article = await getArticle(vaultRoot, snapshot.articleId)
        if (article.etag !== snapshot.articleEtag)
          throw new WorkspaceError(`conflict`, `Article changed after preflight`, { currentEtag: article.etag })
        const logs = []
        let result
        try {
          result = await publisher.publishHtml({
            html: snapshot.html,
            title: snapshot.title,
            author: snapshot.author || undefined,
            cover: snapshot.cover || undefined,
            log: (...items) => logs.push(items.join(` `)),
          })
        }
        catch (error) {
          error.status = 502
          throw error
        }
        let receipt = null
        let receiptWarning = null
        try {
          receipt = await recordPublishReceipt(vaultRoot, snapshot.articleId, {
            renderedHtml: snapshot.html,
            snapshotHash: snapshot.snapshotHash,
            revision: snapshot.revision,
            result,
            logs,
          })
        }
        catch (error) {
          receiptWarning = `微信草稿已创建，但本地发布回执保存失败：${error.message}`
        }
        return json(res, 200, {
          ...result,
          articleId: snapshot.articleId,
          revision: snapshot.revision,
          snapshotHash: snapshot.snapshotHash,
          logs,
          receipt,
          receiptWarning,
        })
      }

      return json(res, 404, { error: { code: `not_found`, message: `${req.method} ${pathname}` } })
    }
    catch (error) {
      return errorResponse(res, error)
    }
  })
}

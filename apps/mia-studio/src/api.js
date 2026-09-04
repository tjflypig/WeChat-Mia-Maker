export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`)
    this.name = `ApiError`
    this.status = status
    this.code = body?.error?.code || `request_failed`
    this.details = body?.error?.details
  }
}

export async function api(path, options = {}) {
  const response = await fetch(`/v1${path}`, {
    credentials: `same-origin`,
    ...options,
    headers: {
      ...(options.body ? { 'content-type': `application/json` } : {}),
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new ApiError(response.status, body)
  return { body, etag: response.headers.get(`etag`)?.replace(/^"|"$/g, ``) || body.etag }
}

import { usePostStore } from '@/stores/post'

export async function uploadMiaImage(file: File): Promise<string> {
  const articleId = usePostStore().currentPost?.id
  if (!articleId)
    throw new Error(`当前没有可保存图片的文章`)
  if (![`image/jpeg`, `image/png`, `image/gif`, `image/webp`].includes(file.type))
    throw new Error(`仅支持 JPEG、PNG、GIF 和 WebP 图片`)

  const response = await fetch(`/v1/articles/${encodeURIComponent(articleId)}/assets`, {
    method: `POST`,
    credentials: `same-origin`,
    headers: {
      'content-type': file.type,
    },
    body: file,
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.url)
    throw new Error(body?.error?.message || `图片保存失败 (${response.status})`)
  return body.url
}

export async function fileUpload(_content: string, file: File): Promise<string> {
  return uploadMiaImage(file)
}

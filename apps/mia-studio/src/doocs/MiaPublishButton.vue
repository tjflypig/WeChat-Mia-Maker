<script setup lang="ts">
import { ImagePlus, Loader2, Send, Sparkles } from '@lucide/vue'
import { buildAIHeaders, resolveEndpointUrl } from '@/composables/useAIFetch'
import useAIImageConfigStore from '@/stores/aiImageConfig'
import { processClipboardContent } from '@/services/export'
import { getArticleSyncInfo, updateArticleMetadata } from '@/storage/repositories/documents'
import { uploadMiaImage } from './mia-upload'
import { useEditorStore } from '@/stores/editor'
import { usePostStore } from '@/stores/post'
import { useThemeStore } from '@/stores/theme'

const editorStore = useEditorStore()
const postStore = usePostStore()
const themeStore = useThemeStore()
const publishing = ref(false)
const uploadingCover = ref(false)
const coverInput = ref<HTMLInputElement | null>(null)
const aiCoverOpen = ref(false)
const aiPrompt = ref(`一张适合微信公众号文章的横版封面，简洁、有留白、具有生活实验感`)
const generatingCover = ref(false)
const aiImageStore = useAIImageConfigStore()
const { endpoint: aiEndpoint, apiKey: aiApiKey, model: aiModel, type: aiType } = storeToRefs(aiImageStore)

async function imageToFile(source: string): Promise<File> {
  const response = await fetch(source)
  if (!response.ok)
    throw new Error(`AI 图片下载失败 (${response.status})`)
  const bitmap = await createImageBitmap(await response.blob())
  const canvas = document.createElement(`canvas`)
  canvas.width = 900
  canvas.height = 383
  const context = canvas.getContext(`2d`)
  if (!context)
    throw new Error(`浏览器不支持图片裁切`)
  const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height)
  const width = bitmap.width * scale
  const height = bitmap.height * scale
  context.fillStyle = `#ffffff`
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, `image/jpeg`, 0.9))
  bitmap.close()
  if (!blob)
    throw new Error(`AI 封面裁切失败`)
  return new File([blob], `ai-cover.jpg`, { type: `image/jpeg` })
}

async function generateCover() {
  if (generatingCover.value || !aiPrompt.value.trim())
    return
  generatingCover.value = true
  try {
    if (!aiEndpoint.value || !aiModel.value)
      throw new Error(`请先在 doocs/md 的 AI 图片设置中配置服务和模型`)
    const response = await fetch(resolveEndpointUrl(aiEndpoint.value, `image`), {
      method: `POST`,
      headers: buildAIHeaders(aiApiKey.value, aiType.value),
      body: JSON.stringify({ model: aiModel.value, prompt: aiPrompt.value.trim(), size: `1792x1024`, n: 1 }),
    })
    if (!response.ok)
      throw new Error(`${response.status}: ${await response.text()}`)
    const body = await response.json()
    const source = body?.data?.[0]?.url || (body?.data?.[0]?.b64_json ? `data:image/png;base64,${body.data[0].b64_json}` : ``)
    if (!source)
      throw new Error(`AI 没有返回图片`)
    editorStore.flushContentToPostStore()
    await postStore.persistImmediately()
    const post = postStore.currentPost
    if (!post)
      throw new Error(`当前没有可设置封面的文章`)
    const url = await uploadMiaImage(await imageToFile(source))
    await updateArticleMetadata(post.id, { cover: url })
    aiCoverOpen.value = false
    toast.success(`AI 封面已裁切为 900×383 并保存到腾讯云`)
  }
  catch (error) {
    toast.error(`AI 封面生成失败：${error instanceof Error ? error.message : String(error)}`)
  }
  finally {
    generatingCover.value = false
  }
}

async function uploadCover(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ``
  if (!file || uploadingCover.value)
    return
  uploadingCover.value = true
  try {
    editorStore.flushContentToPostStore()
    await postStore.persistImmediately()
    const post = postStore.currentPost
    if (!post)
      throw new Error(`当前没有可设置封面的文章`)
    const url = await uploadMiaImage(file)
    await updateArticleMetadata(post.id, { cover: url })
    toast.success(`封面已保存到腾讯云`)
  }
  catch (error) {
    toast.error(`封面上传失败：${error instanceof Error ? error.message : String(error)}`)
  }
  finally {
    uploadingCover.value = false
  }
}

async function request(path: string, options: RequestInit) {
  const response = await fetch(`/v1${path}`, {
    credentials: `same-origin`,
    ...options,
    headers: {
      'content-type': `application/json`,
      ...options.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new Error(body?.error?.message || `请求失败 (${response.status})`)
  return body
}

async function publishToWechat() {
  if (publishing.value)
    return
  publishing.value = true
  try {
    editorStore.flushContentToPostStore()
    await postStore.persistImmediately()
    const post = postStore.currentPost
    if (!post)
      throw new Error(`当前没有可发布的文章`)
    const { etag, metadata } = getArticleSyncInfo(post.id)
    if (!etag)
      throw new Error(`文章尚未同步到腾讯云，请稍后再试`)

    const rendered = await processClipboardContent(themeStore.primaryColor)
    if (!rendered.html.trim())
      throw new Error(`doocs/md 没有生成可发布的 HTML`)
    if (rendered.hasPendingAsyncContent)
      throw new Error(`图表或公式仍在渲染，请完成后再发布`)

    const preflight = await request(`/articles/${encodeURIComponent(post.id)}/publish/preflight`, {
      method: `POST`,
      headers: { 'if-match': `"${etag}"` },
      body: JSON.stringify({ html: rendered.html, title: post.title, cover: metadata.cover || `` }),
    })
    const confirmed = window.confirm(
      `确认推送到微信公众号草稿箱？\n\n《${preflight.title}》\n版本：${preflight.revision}\n图片：${preflight.imageCount} 张\n渲染 HTML：${preflight.htmlBytes} 字节\n\n确认后将调用微信接口。`,
    )
    if (!confirmed) {
      toast.info(`已取消发布`)
      return
    }

    const result = await request(`/articles/${encodeURIComponent(post.id)}/publish/confirm`, {
      method: `POST`,
      body: JSON.stringify({ confirmationId: preflight.confirmationId }),
    })
    if (result.receiptWarning)
      toast.warning(result.receiptWarning)
    else
      toast.success(`已推送到微信草稿箱并保存发布快照：${result.title}`)
  }
  catch (error) {
    toast.error(`发布失败：${error instanceof Error ? error.message : String(error)}`)
  }
  finally {
    publishing.value = false
  }
}
</script>

<template>
  <div class="flex items-center gap-2">
    <input ref="coverInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="sr-only" @change="uploadCover">
    <Button
      variant="outline"
      class="h-9 max-md:w-9 max-md:px-0"
      :disabled="uploadingCover || publishing"
      :aria-busy="uploadingCover"
      aria-label="上传文章封面"
      @click="coverInput?.click()"
    >
      <Loader2 v-if="uploadingCover" class="size-4 animate-spin md:mr-2" />
      <ImagePlus v-else class="size-4 md:mr-2" />
      <span class="max-md:hidden">封面</span>
    </Button>
    <Button
      variant="outline"
      class="h-9 max-md:w-9 max-md:px-0"
      :disabled="uploadingCover || publishing || generatingCover"
      aria-label="AI 生成文章封面"
      @click="aiCoverOpen = true"
    >
      <Sparkles class="size-4 md:mr-2" />
      <span class="max-md:hidden">AI 封面</span>
    </Button>
    <Button
      variant="default"
      class="mia-publish-button h-9 max-md:w-9 max-md:px-0"
      :disabled="publishing || uploadingCover"
      :aria-busy="publishing"
      aria-label="发布到微信草稿箱"
      @click="publishToWechat"
    >
      <Loader2 v-if="publishing" class="size-4 animate-spin md:mr-2" />
      <Send v-else class="size-4 md:mr-2" />
      <span class="max-md:hidden">发到草稿</span>
    </Button>

    <Dialog v-model:open="aiCoverOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI 生成封面</DialogTitle>
          <DialogDescription>固定输出微信公众号横版封面 900×383，生成后会保存到当前文章。</DialogDescription>
        </DialogHeader>
        <Textarea v-model="aiPrompt" rows="4" placeholder="描述你想要的封面画面…" :disabled="generatingCover" />
        <div class="flex justify-end gap-2">
          <Button variant="outline" :disabled="generatingCover" @click="aiCoverOpen = false">取消</Button>
          <Button :disabled="generatingCover || !aiPrompt.trim()" :aria-busy="generatingCover" @click="generateCover">
            <Loader2 v-if="generatingCover" class="mr-2 size-4 animate-spin" />
            <Sparkles v-else class="mr-2 size-4" />
            {{ generatingCover ? '生成中…' : '生成并设为封面' }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

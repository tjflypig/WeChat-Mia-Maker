<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  Archive,
  BookOpenText,
  Check,
  ChevronRight,
  CircleAlert,
  FilePlus2,
  Files,
  Inbox,
  Lightbulb,
  LoaderCircle,
  LogOut,
  Menu,
  PanelRight,
  PenLine,
  Plus,
  Rocket,
  Save,
  Search,
  Send,
  Sparkles,
  X,
} from '@lucide/vue'
import { api, ApiError } from './api.js'
import { createDoocsAdapter } from '@mia/md-adapter'

const stages = [
  { id: `topics`, label: `选题`, icon: Lightbulb },
  { id: `materials`, label: `素材`, icon: Inbox },
  { id: `write`, label: `写作`, icon: PenLine },
  { id: `preview`, label: `预览`, icon: BookOpenText },
  { id: `publish`, label: `发布`, icon: Send },
]

const booting = ref(true)
const authenticated = ref(false)
const loginPassword = ref(``)
const loginError = ref(``)
const loginBusy = ref(false)
const activeStage = ref(`write`)
const activeLibrary = ref(`articles`)
const topics = ref([])
const articles = ref([])
const selectedArticle = ref(null)
const articleBody = ref(``)
const frontmatterBlock = ref(``)
const currentEtag = ref(``)
const saveState = ref(`idle`)
const errorBanner = ref(``)
const newTopicTitle = ref(``)
const creatingTopic = ref(false)
const libraryOpen = ref(false)
const inspectorOpen = ref(false)
const quickFind = ref(``)
let saveTimer
let acceptingRemoteContent = false
const mdAdapter = createDoocsAdapter(globalThis.__MIA_DOOCS_ENGINE__)

const currentTitle = computed(() => selectedArticle.value?.frontmatter?.title || `未选择文章`)
const filteredArticles = computed(() => articles.value.filter(item => item.title.toLowerCase().includes(quickFind.value.toLowerCase())))
const wordCount = computed(() => articleBody.value.replace(/\s/g, ``).length)
const readingMinutes = computed(() => Math.max(1, Math.ceil(wordCount.value / 400)))
const saveLabel = computed(() => ({
  idle: `已存到服务器`,
  dirty: `有修改`,
  saving: `保存中`,
  conflict: `有版本冲突`,
  error: `保存失败`,
}[saveState.value] || `等待保存`))

const previewHtml = computed(() => mdAdapter.render(`${frontmatterBlock.value}${articleBody.value}`).html)

function splitEditableDocument(content) {
  const match = String(content).match(/^(---\n[\s\S]*?\n---\n?)([\s\S]*)$/)
  return match ? { frontmatter: match[1], body: match[2] } : { frontmatter: ``, body: String(content) }
}

async function boot() {
  try {
    await api(`/session`)
    authenticated.value = true
    await loadWorkspace()
  }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401)
      errorBanner.value = error.message
  }
  finally {
    booting.value = false
  }
}

async function login() {
  if (!loginPassword.value) return
  loginBusy.value = true
  loginError.value = ``
  try {
    await api(`/auth/login`, { method: `POST`, body: JSON.stringify({ password: loginPassword.value }) })
    loginPassword.value = ``
    authenticated.value = true
    await loadWorkspace()
  }
  catch (error) {
    loginError.value = error.message
  }
  finally {
    loginBusy.value = false
  }
}

async function logout() {
  await api(`/auth/logout`, { method: `POST` }).catch(() => {})
  authenticated.value = false
  selectedArticle.value = null
  articles.value = []
  topics.value = []
}

async function loadWorkspace() {
  const [topicResponse, articleResponse] = await Promise.all([api(`/topics`), api(`/articles`)])
  topics.value = topicResponse.body.topics
  articles.value = articleResponse.body.articles
  if (!selectedArticle.value && articles.value.length)
    await openArticle(articles.value[0].id)
}

async function openArticle(id) {
  if (saveState.value === `dirty`)
    await saveArticle()
  try {
    const { body, etag } = await api(`/articles/${encodeURIComponent(id)}`)
    acceptingRemoteContent = true
    selectedArticle.value = body
    const document = splitEditableDocument(body.content)
    frontmatterBlock.value = document.frontmatter
    articleBody.value = document.body
    currentEtag.value = etag
    saveState.value = `idle`
    activeStage.value = `write`
    libraryOpen.value = false
    await nextTick()
    acceptingRemoteContent = false
  }
  catch (error) {
    acceptingRemoteContent = false
    errorBanner.value = error.message
  }
}

async function createTopic() {
  const title = newTopicTitle.value.trim()
  if (!title) return
  creatingTopic.value = true
  try {
    await api(`/topics`, { method: `POST`, body: JSON.stringify({ title }) })
    newTopicTitle.value = ``
    topics.value = (await api(`/topics`)).body.topics
  }
  catch (error) {
    errorBanner.value = error.message
  }
  finally {
    creatingTopic.value = false
  }
}

async function promoteTopic(id) {
  try {
    const { body } = await api(`/topics/${encodeURIComponent(id)}/promote`, { method: `POST` })
    await loadWorkspace()
    await openArticle(body.id)
  }
  catch (error) {
    errorBanner.value = error.message
  }
}

async function createArticle() {
  try {
    const { body } = await api(`/articles`, { method: `POST`, body: JSON.stringify({ title: `未命名文章` }) })
    await loadWorkspace()
    await openArticle(body.id)
  }
  catch (error) {
    errorBanner.value = error.message
  }
}

async function saveArticle() {
  clearTimeout(saveTimer)
  if (!selectedArticle.value || !currentEtag.value || saveState.value === `saving`) return
  saveState.value = `saving`
  try {
    const { body, etag } = await api(`/articles/${encodeURIComponent(selectedArticle.value.id)}`, {
      method: `PUT`,
      headers: { 'if-match': `"${currentEtag.value}"` },
      body: JSON.stringify({ content: `${frontmatterBlock.value}${articleBody.value}` }),
    })
    selectedArticle.value = body
    frontmatterBlock.value = splitEditableDocument(body.content).frontmatter
    currentEtag.value = etag
    saveState.value = `idle`
    const item = articles.value.find(article => article.id === body.id)
    if (item) item.updatedAt = body.frontmatter.updated_at
  }
  catch (error) {
    saveState.value = error.code === `conflict` ? `conflict` : `error`
    errorBanner.value = error.code === `conflict`
      ? `这篇文章已在其他终端更新。你的内容仍保留在当前页面。`
      : error.message
  }
}

function onEditorInput() {
  saveState.value = `dirty`
  clearTimeout(saveTimer)
  saveTimer = setTimeout(saveArticle, 900)
}

function onKeydown(event) {
  const command = event.metaKey || event.ctrlKey
  if (command && event.key.toLowerCase() === `s`) {
    event.preventDefault()
    saveArticle()
  }
  if (command && event.key.toLowerCase() === `k`) {
    event.preventDefault()
    inspectorOpen.value = true
  }
  if (command && event.shiftKey && event.key.toLowerCase() === `p`) {
    event.preventDefault()
    activeStage.value = `publish`
  }
  if (event.key === `Escape`) {
    inspectorOpen.value = false
    libraryOpen.value = false
  }
}

watch(articleBody, () => {
  if (!acceptingRemoteContent && selectedArticle.value)
    onEditorInput()
})

onMounted(() => {
  window.addEventListener(`keydown`, onKeydown)
  boot()
})
onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  window.removeEventListener(`keydown`, onKeydown)
})
</script>

<template>
  <main v-if="booting" class="boot-screen" aria-live="polite">
    <div class="brand-mark">M</div>
    <p>正在打开工作台…</p>
  </main>

  <main v-else-if="!authenticated" class="login-shell">
    <section class="login-panel" aria-labelledby="login-title">
      <div class="login-brand">
        <div class="brand-mark">M</div>
        <span>Mia Studio</span>
      </div>
      <div class="login-copy">
        <h1 id="login-title">回到你的创作现场</h1>
        <p>选题、素材和稿件都保存在你自己的服务器上。</p>
      </div>
      <form @submit.prevent="login">
        <label for="password">访问密码</label>
        <input id="password" v-model="loginPassword" type="password" autocomplete="current-password" placeholder="输入密码" autofocus>
        <p v-if="loginError" class="field-error" role="alert">{{ loginError }}</p>
        <button class="button primary login-button" :disabled="loginBusy || !loginPassword">
          <LoaderCircle v-if="loginBusy" class="spin" :size="18" />
          <span>{{ loginBusy ? `正在登录` : `进入工作台` }}</span>
        </button>
      </form>
      <p class="login-footnote">私有部署 · 数据不离开你的腾讯云</p>
    </section>
  </main>

  <main v-else class="studio-shell">
    <header class="topbar">
      <div class="topbar-start">
        <button class="icon-button mobile-only" title="打开内容库" aria-label="打开内容库" @click="libraryOpen = true">
          <Menu :size="20" />
        </button>
        <div class="mini-mark">M</div>
        <div class="document-title">
          <strong>{{ currentTitle }}</strong>
          <span :class="[`save-${saveState}`]">{{ saveLabel }}</span>
        </div>
      </div>
      <div class="topbar-actions">
        <button class="button quiet desktop-only" @click="inspectorOpen = !inspectorOpen">
          <Sparkles :size="17" /> AI 助手
        </button>
        <button class="button quiet desktop-only" @click="activeStage = `preview`">
          <BookOpenText :size="17" /> 预览
        </button>
        <button class="button primary" @click="activeStage = `publish`">
          <Rocket :size="17" /> <span class="desktop-only">发布预检</span><span class="mobile-only">发布</span>
        </button>
      </div>
    </header>

    <div v-if="errorBanner" class="error-banner" role="alert">
      <CircleAlert :size="18" />
      <span>{{ errorBanner }}</span>
      <button class="icon-button" aria-label="关闭提示" @click="errorBanner = ``"><X :size="18" /></button>
    </div>

    <div class="studio-body">
      <aside :class="[`library`, { open: libraryOpen }]">
        <div class="library-mobile-head mobile-only">
          <strong>内容库</strong>
          <button class="icon-button" aria-label="关闭内容库" @click="libraryOpen = false"><X :size="20" /></button>
        </div>
        <nav class="library-tabs" aria-label="内容库分类">
          <button :class="{ active: activeLibrary === `articles` }" @click="activeLibrary = `articles`"><Files :size="16" /> 文章</button>
          <button :class="{ active: activeLibrary === `topics` }" @click="activeLibrary = `topics`"><Lightbulb :size="16" /> 选题</button>
        </nav>

        <template v-if="activeLibrary === `articles`">
          <div class="library-tools">
            <label class="search-field"><Search :size="16" /><input v-model="quickFind" placeholder="搜索文章" aria-label="搜索文章"></label>
            <button class="icon-button" title="新建文章" aria-label="新建文章" @click="createArticle"><FilePlus2 :size="18" /></button>
          </div>
          <div v-if="filteredArticles.length" class="entity-list">
            <button v-for="article in filteredArticles" :key="article.id" :class="[`entity-row`, { active: selectedArticle?.id === article.id }]" @click="openArticle(article.id)">
              <span><strong>{{ article.title }}</strong><small>{{ article.status === `drafting` ? `写作中` : article.status }}</small></span>
              <ChevronRight :size="16" />
            </button>
          </div>
          <div v-else class="empty-state compact">
            <Files :size="24" />
            <p>还没有文章。</p>
            <button class="text-button" @click="createArticle">创建第一篇</button>
          </div>
        </template>

        <template v-else>
          <div v-if="topics.length" class="entity-list topic-list">
            <button v-for="topic in topics" :key="topic.id" class="entity-row" @click="promoteTopic(topic.id)">
              <span><strong>{{ topic.title }}</strong><small>{{ topic.status === `candidate` ? `候选` : `已立项` }}</small></span>
              <ChevronRight :size="16" />
            </button>
          </div>
          <div v-else class="empty-state compact"><Lightbulb :size="24" /><p>先记下一个值得写的念头。</p></div>
        </template>
        <div class="library-footer">
          <button class="account-button" @click="logout"><span class="account-avatar">M</span><span>Mia</span><LogOut :size="16" /></button>
        </div>
      </aside>

      <section class="main-stage">
        <section v-show="activeStage === `topics`" class="stage-page narrow-stage">
          <div class="stage-heading"><div><h1>选题</h1><p>把念头记下来，等证据和真实细节长齐。</p></div></div>
          <form class="capture-row" @submit.prevent="createTopic">
            <input v-model="newTopicTitle" placeholder="我想写…" aria-label="新选题标题">
            <button class="button primary" :disabled="creatingTopic || !newTopicTitle.trim()"><Plus :size="18" /> 记下</button>
          </form>
          <div v-if="topics.length" class="topic-board">
            <article v-for="topic in topics" :key="topic.id" class="topic-item">
              <div><span class="status-dot"></span><small>{{ topic.status === `candidate` ? `候选` : `写作中` }}</small><h2>{{ topic.title }}</h2></div>
              <button class="button quiet" @click="promoteTopic(topic.id)">{{ topic.status === `candidate` ? `立项` : `打开文章` }} <ChevronRight :size="16" /></button>
            </article>
          </div>
          <div v-else class="empty-state"><Lightbulb :size="32" /><h2>选题池还是空的</h2><p>从一个你真正动手做过的实验开始。</p></div>
        </section>

        <section v-show="activeStage === `materials`" class="stage-page narrow-stage">
          <div class="stage-heading"><div><h1>素材</h1><p>随手收集照片、对话、数据和参考链接。</p></div></div>
          <div class="empty-state"><Archive :size="32" /><h2>素材入口正在接线</h2><p>本阶段会直接写入 Vault 的 20-materials，不会存入浏览器私有空间。</p></div>
        </section>

        <section v-show="activeStage === `write`" class="editor-stage">
          <template v-if="selectedArticle">
            <div class="editor-toolbar">
              <div class="view-switch"><button class="active">编辑</button><button @click="activeStage = `preview`">预览</button></div>
              <button class="button quiet" :disabled="saveState === `saving`" @click="saveArticle"><Save :size="16" /> {{ saveState === `saving` ? `保存中` : `保存` }}</button>
            </div>
            <textarea v-model="articleBody" class="markdown-editor" spellcheck="false" :aria-label="`编辑${currentTitle}`"></textarea>
          </template>
          <div v-else class="empty-state"><PenLine :size="32" /><h2>选一篇文章开始写</h2><p>也可以从选题立项，自动建立文章与素材目录。</p><button class="button primary" @click="createArticle"><Plus :size="18" /> 新建文章</button></div>
        </section>

        <section v-show="activeStage === `preview`" class="preview-stage">
          <div class="preview-toolbar"><div><strong>微信预览</strong><span>{{ mdAdapter.degraded ? `基础降级预览 · doocs/md 引擎待注入` : `doocs/md 渲染` }}</span></div><button class="button quiet" @click="activeStage = `write`"><PenLine :size="16" /> 继续编辑</button></div>
          <div class="phone-canvas"><article class="wechat-article" v-html="previewHtml"></article></div>
        </section>

        <section v-show="activeStage === `publish`" class="stage-page publish-stage">
          <div class="stage-heading"><div><h1>发布预检</h1><p>在向微信草稿箱提交前，逐项确认这个版本。</p></div><span class="revision-pill">Revision {{ selectedArticle?.frontmatter?.revision || 0 }}</span></div>
          <div class="preflight-list">
            <div class="check-row pass"><Check :size="20" /><span><strong>标题</strong><small>{{ selectedArticle?.frontmatter?.title || `尚未填写` }}</small></span></div>
            <div class="check-row" :class="selectedArticle?.frontmatter?.summary ? `pass` : `waiting`"><component :is="selectedArticle?.frontmatter?.summary ? Check : CircleAlert" :size="20" /><span><strong>摘要</strong><small>{{ selectedArticle?.frontmatter?.summary || `需要补充摘要` }}</small></span></div>
            <div class="check-row" :class="selectedArticle?.frontmatter?.cover ? `pass` : `waiting`"><component :is="selectedArticle?.frontmatter?.cover ? Check : CircleAlert" :size="20" /><span><strong>封面</strong><small>{{ selectedArticle?.frontmatter?.cover || `需要选择封面` }}</small></span></div>
            <div class="check-row" :class="mdAdapter.degraded ? `waiting` : `pass`"><component :is="mdAdapter.degraded ? LoaderCircle : Check" :size="20" /><span><strong>doocs/md 渲染</strong><small>{{ mdAdapter.degraded ? `等待服务端注入 doocs/md 引擎` : `渲染成功` }}</small></span></div>
            <div class="check-row waiting"><LoaderCircle :size="20" /><span><strong>微信接口</strong><small>尚未连接发布凭据</small></span></div>
          </div>
          <div class="publish-footer"><p>预检全部通过后才能推送，不会盲发。</p><button class="button primary" disabled><Send :size="18" /> 推送到微信草稿箱</button></div>
        </section>

        <footer class="statusbar desktop-only"><span>{{ wordCount }} 字</span><span>约 {{ readingMinutes }} 分钟阅读</span><span class="statusbar-save"><span :class="[`status-light`, saveState]"></span>{{ saveLabel }}</span></footer>
      </section>

      <aside :class="[`inspector`, { open: inspectorOpen }]" :aria-hidden="!inspectorOpen" :inert="!inspectorOpen">
        <div class="inspector-head"><div><Sparkles :size="18" /><strong>AI 助手</strong></div><button class="icon-button" aria-label="关闭 AI 助手" @click="inspectorOpen = false"><X :size="18" /></button></div>
        <div class="inspector-context"><small>当前文章</small><strong>{{ currentTitle }}</strong><p>AI 建议将以可审阅的 diff 提案出现，不会自动改写正文。</p></div>
        <div class="ai-actions">
          <button disabled><span><strong>DNA 质检</strong><small>检查人味、空话和现场细节</small></span><ChevronRight :size="17" /></button>
          <button disabled><span><strong>结构建议</strong><small>找到断层和重复段落</small></span><ChevronRight :size="17" /></button>
          <button disabled><span><strong>生成摘要</strong><small>保留文章的真实语气</small></span><ChevronRight :size="17" /></button>
        </div>
        <p class="coming-note">统一 AI 配置与 doocs/md 原有能力将通过服务端网关接入。</p>
      </aside>
    </div>

    <nav class="mobile-nav mobile-only" aria-label="创作流程">
      <button v-for="stage in stages" :key="stage.id" :class="{ active: activeStage === stage.id }" @click="activeStage = stage.id"><component :is="stage.icon" :size="21" /><span>{{ stage.label }}</span></button>
    </nav>
    <div v-if="libraryOpen || inspectorOpen" class="scrim" @click="libraryOpen = false; inspectorOpen = false"></div>
  </main>
</template>

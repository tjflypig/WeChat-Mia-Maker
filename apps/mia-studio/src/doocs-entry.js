import './login-gate.css'

const doocsMain = () => import('../../../vendor/doocs-md/apps/web/src/main.ts')

async function request(path, options) {
  const response = await fetch(`/v1${path}`, {
    credentials: `same-origin`,
    ...options,
    headers: {
      ...(options?.body ? { 'content-type': `application/json` } : {}),
      ...options?.headers,
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok)
    throw Object.assign(new Error(body?.error?.message || `请求失败`), { status: response.status })
  return body
}

function showLogin() {
  const app = document.querySelector(`#app`)
  app.innerHTML = `
    <main class="mia-login">
      <form class="mia-login-card" aria-labelledby="mia-login-title">
        <div class="mia-login-brand" aria-hidden="true">M</div>
        <p class="mia-login-kicker">MIA STUDIO</p>
        <h1 id="mia-login-title">回到你的创作工作台</h1>
        <p class="mia-login-copy">登录后进入 doocs/md 原生编辑器，文章自动保存到你的腾讯云 Vault。</p>
        <input name="username" type="text" autocomplete="username" value="owner" hidden />
        <label for="mia-password">工作台密码</label>
        <input id="mia-password" name="password" type="password" autocomplete="current-password" required />
        <p class="mia-login-error" role="alert" aria-live="polite"></p>
        <button type="submit">登录并继续</button>
      </form>
    </main>`

  const form = app.querySelector(`form`)
  const input = app.querySelector(`#mia-password`)
  const button = app.querySelector(`button`)
  const error = app.querySelector(`.mia-login-error`)
  input.focus()

  form.addEventListener(`submit`, async (event) => {
    event.preventDefault()
    button.disabled = true
    button.textContent = `正在登录…`
    error.textContent = ``
    try {
      await request(`/auth/login`, {
        method: `POST`,
        body: JSON.stringify({ password: input.value }),
      })
      app.replaceChildren()
      await doocsMain()
    }
    catch (loginError) {
      error.textContent = loginError.message
      input.focus()
      input.select()
      button.disabled = false
      button.textContent = `登录并继续`
    }
  })
}

try {
  await request(`/session`)
  await doocsMain()
}
catch (error) {
  if (error.status === 401)
    showLogin()
  else {
    document.querySelector(`#app`).innerHTML = `<main class="mia-login"><p role="alert">无法连接工作台服务，请确认 API 已启动后刷新页面。</p></main>`
  }
}

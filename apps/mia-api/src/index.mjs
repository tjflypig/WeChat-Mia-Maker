import process from 'node:process'
import { createMiaServer } from './server.mjs'
import { createLegacyPublisher } from './publisher.mjs'

const port = Number(process.env.MIA_PORT || 8787)
const host = process.env.MIA_HOST || `127.0.0.1`

const server = await createMiaServer({
  vaultRoot: process.env.MIA_VAULT_ROOT,
  adminPassword: process.env.MIA_ADMIN_PASSWORD,
  sessionSecret: process.env.MIA_SESSION_SECRET,
  apiToken: process.env.MIA_API_TOKEN,
  publisher: createLegacyPublisher({
    corePath: process.env.MIA_PUBLISHER_CORE,
    envPath: process.env.MIA_PUBLISHER_ENV,
    cachePath: process.env.MIA_PUBLISHER_CACHE,
  }),
  secureCookies: process.env.NODE_ENV === `production`,
})

server.listen(port, host, () => {
  console.log(`Mia API listening on http://${host}:${port}`)
})

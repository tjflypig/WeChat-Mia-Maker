import { createRequire } from 'node:module'
import path from 'node:path'

export function createLegacyPublisher({ corePath, envPath, cachePath }) {
  if (!corePath || !envPath)
    return null

  const require = createRequire(import.meta.url)
  const core = require(path.resolve(corePath))
  core.setEnv(path.resolve(envPath))
  if (cachePath)
    core.setCachePath(path.resolve(cachePath))

  return {
    publishHtml(options) {
      return core.publishHtml(options)
    },
  }
}

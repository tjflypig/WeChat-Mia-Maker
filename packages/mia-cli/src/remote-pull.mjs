import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { atomicWrite, parseFrontmatter, WorkspaceError } from '@mia/workspace'
import { fetchArticle } from './remote-push.mjs'

export async function pullArticleToFile({ apiUrl, apiToken, id, file, force = false }) {
  if (!file)
    throw new WorkspaceError(`missing_file`, `--file is required`)

  const absoluteFile = path.resolve(file)
  const article = await fetchArticle({ apiUrl, apiToken, id })
  let previous = null
  try {
    await stat(absoluteFile)
    previous = await readFile(absoluteFile, `utf8`)
  }
  catch (error) {
    if (error?.code !== `ENOENT`)
      throw error
  }

  if (previous !== null) {
    const localId = parseFrontmatter(previous).id
    if (!force && localId !== article.id) {
      throw new WorkspaceError(
        `pull_target_mismatch`,
        `目标文件不是同一篇文章；如确认覆盖请加 --force`,
        { expected: article.id, actual: localId || null },
      )
    }
  }

  const backupFile = previous !== null && previous !== article.content ? `${absoluteFile}.mia-backup` : null
  if (backupFile)
    await atomicWrite(backupFile, previous)
  await atomicWrite(absoluteFile, article.content)
  return { id: article.id, etag: article.etag, targetFile: absoluteFile, backupFile }
}

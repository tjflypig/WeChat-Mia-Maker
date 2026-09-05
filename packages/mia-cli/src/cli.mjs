#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  atomicWrite,
  createArticle,
  createTopic,
  getArticle,
  initVault,
  listArticles,
  listTopics,
  parseFrontmatter,
  patchFrontmatter,
  promoteTopic,
  publicEntity,
  saveArticle,
  WorkspaceError,
} from '@mia/workspace'
import { MiaApiError, pushArticle } from './remote-push.mjs'
import { pullArticleToFile } from './remote-pull.mjs'

function takeOption(args, name, fallback) {
  const index = args.indexOf(name)
  if (index === -1)
    return fallback
  const value = args[index + 1]
  args.splice(index, 2)
  return value
}

function takeFlag(args, name) {
  const index = args.indexOf(name)
  if (index === -1)
    return false
  args.splice(index, 1)
  return true
}

function usage() {
  return `mia - Mia Studio workspace CLI

Usage:
  mia vault init [path]
  mia status [--vault path] [--json]
  mia topic list [--status candidate] [--vault path] [--json]
  mia topic add <title> [--source manual] [--pillar name] [--vault path] [--json]
  mia topic pick <topic-id> [--vault path] [--json]
  mia article list [--status drafting] [--vault path] [--json]
  mia article create <title> [--vault path] [--json]
  mia article show <article-id> [--vault path] [--json]
  mia article write <article-id> --file article.md --if-match <etag> [--vault path] [--json]
  mia article push <file.md> [--api url] [--token token] [--id article-id] [--title title] [--no-write-id] [--json]
  mia article pull <article-id> --file article.md [--api url] [--token token] [--force] [--json]

Remote push defaults:
  --api    MIA_API_URL or http://127.0.0.1:8787
  --token  MIA_API_TOKEN (environment variable recommended)
`
}

const args = process.argv.slice(2)
const jsonOutput = takeFlag(args, `--json`)
const noWriteId = takeFlag(args, `--no-write-id`)
const force = takeFlag(args, `--force`)
const vaultRoot = path.resolve(takeOption(args, `--vault`, process.env.MIA_VAULT_ROOT || `vault`))
const apiUrl = takeOption(args, `--api`, process.env.MIA_API_URL || `http://127.0.0.1:8787`)
const apiToken = takeOption(args, `--token`, process.env.MIA_API_TOKEN || ``)
const [group, action, ...positionals] = args

function output(value) {
  if (jsonOutput)
    console.log(JSON.stringify(value, null, 2))
  else if (typeof value === `string`)
    console.log(value)
  else
    console.log(value)
}

try {
  if (!group || group === `help` || group === `--help` || group === `-h`) {
    output(usage())
  }
  else if (group === `vault` && action === `init`) {
    const root = path.resolve(positionals[0] || vaultRoot)
    output(await initVault(root))
  }
  else if (group === `status`) {
    output(await initVault(vaultRoot))
  }
  else if (group === `topic` && action === `list`) {
    output(await listTopics(vaultRoot, { status: takeOption(positionals, `--status`) }))
  }
  else if (group === `topic` && action === `add`) {
    const title = positionals.shift()
    const topic = await createTopic(vaultRoot, {
      title,
      source: takeOption(positionals, `--source`, `manual`),
      pillar: takeOption(positionals, `--pillar`, `unassigned`),
    })
    output(publicEntity(topic))
  }
  else if (group === `topic` && action === `pick`) {
    output(publicEntity(await promoteTopic(vaultRoot, positionals[0])))
  }
  else if (group === `article` && action === `list`) {
    output(await listArticles(vaultRoot, { status: takeOption(positionals, `--status`) }))
  }
  else if (group === `article` && action === `create`) {
    output(publicEntity(await createArticle(vaultRoot, { title: positionals[0] })))
  }
  else if (group === `article` && action === `show`) {
    const article = await getArticle(vaultRoot, positionals[0])
    output(jsonOutput ? publicEntity(article) : article.content)
  }
  else if (group === `article` && action === `write`) {
    const id = positionals.shift()
    const file = takeOption(positionals, `--file`)
    const ifMatch = takeOption(positionals, `--if-match`)
    if (!file)
      throw new WorkspaceError(`missing_file`, `--file is required`)
    output(publicEntity(await saveArticle(vaultRoot, id, await readFile(path.resolve(file), `utf8`), { ifMatch })))
  }
  else if (group === `article` && action === `push`) {
    const file = positionals.shift()
    if (!file)
      throw new WorkspaceError(`missing_file`, `Markdown file is required`)
    const absoluteFile = path.resolve(file)
    const content = await readFile(absoluteFile, `utf8`)
    const result = await pushArticle({
      apiUrl,
      apiToken,
      content,
      id: takeOption(positionals, `--id`),
      title: takeOption(positionals, `--title`),
      fallbackTitle: path.basename(file, path.extname(file)),
    })
    const shouldWriteId = !noWriteId && !parseFrontmatter(content).id
    if (shouldWriteId)
      await atomicWrite(absoluteFile, patchFrontmatter(content, { id: result.id }))
    output(jsonOutput
      ? { ...result, sourceFile: absoluteFile, sourceUpdated: shouldWriteId }
      : `已推送到 Mia Studio：${result.id}${shouldWriteId ? `（文章 ID 已写回源文件）` : ``}`)
  }
  else if (group === `article` && action === `pull`) {
    const id = positionals.shift()
    const file = takeOption(positionals, `--file`)
    if (!id)
      throw new WorkspaceError(`missing_article_id`, `Article id is required`)
    if (!file)
      throw new WorkspaceError(`missing_file`, `--file is required`)
    const result = await pullArticleToFile({ apiUrl, apiToken, id, file, force })
    output(jsonOutput
      ? result
      : `已从 Mia Studio 拉回：${result.id}${result.backupFile ? `（原文件备份：${result.backupFile}）` : ``}`)
  }
  else {
    console.error(usage())
    throw new WorkspaceError(`unknown_command`, `Unknown command: ${args.join(` `)}`)
  }
}
catch (error) {
  const code = error instanceof WorkspaceError || error instanceof MiaApiError ? error.code : `unexpected_error`
  const body = { error: { code, message: error.message, details: error.details } }
  console.error(jsonOutput ? JSON.stringify(body) : `${code}: ${error.message}`)
  process.exitCode = 1
}

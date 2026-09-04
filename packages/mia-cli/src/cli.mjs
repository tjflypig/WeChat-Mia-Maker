#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  createArticle,
  createTopic,
  getArticle,
  initVault,
  listArticles,
  listTopics,
  promoteTopic,
  publicEntity,
  saveArticle,
  WorkspaceError,
} from '@mia/workspace'

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
`
}

const args = process.argv.slice(2)
const jsonOutput = takeFlag(args, `--json`)
const vaultRoot = path.resolve(takeOption(args, `--vault`, process.env.MIA_VAULT_ROOT || `vault`))
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
  else {
    console.error(usage())
    throw new WorkspaceError(`unknown_command`, `Unknown command: ${args.join(` `)}`)
  }
}
catch (error) {
  const code = error instanceof WorkspaceError ? error.code : `unexpected_error`
  const body = { error: { code, message: error.message, details: error.details } }
  console.error(jsonOutput ? JSON.stringify(body) : `${code}: ${error.message}`)
  process.exitCode = 1
}

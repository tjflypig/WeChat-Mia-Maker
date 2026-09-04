import { readFile } from 'node:fs/promises'
import process from 'node:process'

const rootUrl = new URL('../', import.meta.url)
const [versionFile, packageFile] = await Promise.all([
  readFile(new URL('VERSION', rootUrl), 'utf8'),
  readFile(new URL('package.json', rootUrl), 'utf8'),
])

const expected = versionFile.trim()
const actual = JSON.parse(packageFile).version

if (expected !== actual) {
  console.error(`Version mismatch: VERSION=${expected}, package.json=${actual}`)
  process.exit(1)
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(expected)) {
  console.error(`Invalid semantic version: ${expected}`)
  process.exit(1)
}

console.log(`Version ${expected} is consistent`)

import { readFile } from 'node:fs/promises'
import process from 'node:process'

const rootUrl = new URL('../', import.meta.url)
const packagePaths = [
  `package.json`,
  `apps/mia-api/package.json`,
  `apps/mia-studio/package.json`,
  `packages/mia-cli/package.json`,
  `packages/workspace/package.json`,
  `packages/md-adapter/package.json`,
]
const [versionFile, ...packageFiles] = await Promise.all([
  readFile(new URL('VERSION', rootUrl), 'utf8'),
  ...packagePaths.map(file => readFile(new URL(file, rootUrl), `utf8`)),
])

const expected = versionFile.trim()
const mismatches = packageFiles
  .map((content, index) => ({ file: packagePaths[index], version: JSON.parse(content).version }))
  .filter(item => item.version !== expected)

if (mismatches.length) {
  console.error(`Version mismatch: VERSION=${expected}`)
  for (const item of mismatches)
    console.error(`  ${item.file}=${item.version}`)
  process.exit(1)
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(expected)) {
  console.error(`Invalid semantic version: ${expected}`)
  process.exit(1)
}

console.log(`Version ${expected} is consistent across ${packagePaths.length} packages`)

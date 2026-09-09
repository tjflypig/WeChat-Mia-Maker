const MAX_ARTICLE_EXCERPT = 3200

export const DEFAULT_COVER_RULES = `- 最终画布为 900×383，宽高比约 2.35:1。
- 生成时采用横向构图，主体和关键视觉放在中央安全区，四周背景可自然延展，适合居中裁切。
- 画面真实、克制、干净，带有生活实验感和自然质感，避免廉价营销海报风。
- 不要出现任何文字、字母、数字、Logo、水印、二维码、边框或拼贴分屏。
- 只输出封面画面，不要展示手机、公众号界面或封面样机。`

function plainText(markdown) {
  return String(markdown || ``)
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ``)
    .replace(/```[\s\S]*?```/g, ` `)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, `$1`)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, `$1`)
    .replace(/<[^>]+>/g, ` `)
    .replace(/^[#>*+-]+\s*/gm, ``)
    .replace(/[*_~`]/g, ``)
    .replace(/\s+/g, ` `)
    .trim()
}

export function buildCoverPrompt({ title, summary, content, direction, rules = DEFAULT_COVER_RULES } = {}) {
  const excerpt = plainText(content).slice(0, MAX_ARTICLE_EXCERPT)
  const fixedRules = String(rules || ``).trim()
  const article = [
    `标题：${String(title || `未命名文章`).trim()}`,
    summary ? `摘要：${plainText(summary)}` : ``,
    excerpt ? `正文摘录：${excerpt}` : ``,
  ].filter(Boolean).join(`\n`)

  return `为下面这篇微信公众号文章生成一张横版封面图。

${fixedRules ? `固定规则：\n${fixedRules}\n\n` : ``}文章内容：
${article}${direction ? `\n\n作者补充要求：\n${String(direction).trim()}` : ``}`
}

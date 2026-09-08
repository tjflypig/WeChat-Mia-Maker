const SOURCE = `<blockquote class="md-blockquote">
        <p class="md-blockquote-p">\${formatCountSummary(readingTime.words, minutes)}</p>
      </blockquote>`

const REPLACEMENT = `<section class="md-reading-time" style="box-sizing:border-box;min-height:0;margin:0 0 calc(1em * var(--md-block-spacing));padding:12px 16px;border-left:4px solid var(--md-primary-color);border-radius:6px;background:var(--blockquote-background);">
        <p class="md-reading-time-p" style="min-height:0;margin:0;padding:0;font-size:1em;font-style:italic;line-height:1.5;color:hsl(var(--foreground));">\${formatCountSummary(readingTime.words, minutes)}</p>
      </section>`

export function transformReadingTime(code) {
  if (!code.includes(SOURCE))
    throw new Error(`Pinned doocs reading-time source changed; review the Mia bridge`)
  return code.replace(SOURCE, REPLACEMENT)
}

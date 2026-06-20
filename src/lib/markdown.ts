import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { Presentation, Slide, SlideKind } from './types'

marked.setOptions({ gfm: true, breaks: false })

interface SourceChunk {
  text: string
  start: number
  end: number
}

interface MarkdownSection extends SourceChunk {
  level: number
  title: string
  body: string
  bodyStart: number
}

const headingPattern = /^(#{1,3})\s+(.+?)\s*$/
const TOC_START = '<!-- deckdown-toc:start -->'
const TOC_END = '<!-- deckdown-toc:end -->'

function escapeText(value: string) {
  return value.replace(/[*_`~[\]]/g, '')
}

function bodyAfterFrontmatter(source: string): SourceChunk {
  const normalized = source.replace(/\r\n/g, '\n')
  const frontmatter = normalized.match(/^---\n[\s\S]*?\n---(?:\n|$)/)
  const start = frontmatter?.[0].length || 0
  return { text: normalized.slice(start), start, end: normalized.length }
}

function splitAtSeparators(chunk: SourceChunk): SourceChunk[] {
  const parts: SourceChunk[] = []
  const lines = chunk.text.split('\n')
  let inFence = false
  let partStart = 0
  let offset = 0

  const pushPart = (end: number) => {
    const raw = chunk.text.slice(partStart, end)
    const leading = raw.length - raw.trimStart().length
    const trailing = raw.length - raw.trimEnd().length
    if (raw.trim()) {
      parts.push({
        text: raw.trim(),
        start: chunk.start + partStart + leading,
        end: chunk.start + end - trailing,
      })
    }
  }

  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    if (!inFence && /^\s*---\s*$/.test(line)) {
      pushPart(offset)
      partStart = offset + line.length + (index < lines.length - 1 ? 1 : 0)
    }
    offset += line.length + (index < lines.length - 1 ? 1 : 0)
  })
  pushPart(chunk.text.length)
  return parts
}

function isColumnOpening(line: string) {
  return /^\s*:::(?:\s+block)?\s*$/.test(line)
}

function readColumnBlock(lines: string[], start: number) {
  if (!isColumnOpening(lines[start])) return null
  const content: string[] = []
  let cursor = start + 1
  let fence: string | null = null

  while (cursor < lines.length) {
    const fenceMatch = lines[cursor].match(/^\s*(```|~~~)/)
    if (fenceMatch) {
      fence = fence === fenceMatch[1] ? null : fence || fenceMatch[1]
      content.push(lines[cursor])
      cursor += 1
      continue
    }
    if (!fence && /^\s*:::\s*$/.test(lines[cursor])) {
      return {
        content: content.join('\n').trim(),
        end: cursor + 1,
      }
    }
    content.push(lines[cursor])
    cursor += 1
  }

  return null
}

function extractColumnGroups(source: string) {
  const lines = source.split('\n')
  const output: string[] = []
  const groups: string[][] = []
  let index = 0
  let outerFence: string | null = null

  while (index < lines.length) {
    const fenceMatch = lines[index].match(/^\s*(`{3,}|~{3,})/)
    if (outerFence) {
      output.push(lines[index])
      if (
        fenceMatch &&
        fenceMatch[1][0] === outerFence[0] &&
        fenceMatch[1].length >= outerFence.length
      ) {
        outerFence = null
      }
      index += 1
      continue
    }
    if (fenceMatch) {
      outerFence = fenceMatch[1]
      output.push(lines[index])
      index += 1
      continue
    }

    if (!isColumnOpening(lines[index])) {
      output.push(lines[index])
      index += 1
      continue
    }

    const groupStart = index
    const blocks: string[] = []
    let cursor = index

    while (cursor < lines.length && isColumnOpening(lines[cursor])) {
      const block = readColumnBlock(lines, cursor)
      if (!block) break
      blocks.push(block.content)
      cursor = block.end
      while (cursor < lines.length && !lines[cursor].trim()) cursor += 1
    }

    if (blocks.length >= 1) {
      const groupIndex = groups.push(blocks) - 1
      output.push(
        '',
        `<div data-deckdown-columns-placeholder="${groupIndex}"></div>`,
        '',
      )
      index = cursor
    } else {
      output.push(...lines.slice(groupStart, Math.max(cursor, groupStart + 1)))
      index = Math.max(cursor, groupStart + 1)
    }
  }

  return { source: output.join('\n'), groups }
}

function renderMarkdown(source: string) {
  const columns = extractColumnGroups(source)
  const template = document.createElement('template')
  template.innerHTML = marked.parse(columns.source) as string
  template.content
    .querySelectorAll<HTMLElement>('[data-deckdown-columns-placeholder]')
    .forEach((placeholder) => {
      const groupIndex = Number(
        placeholder.dataset.deckdownColumnsPlaceholder || 0,
      )
      const container = document.createElement('div')
      container.className = 'deckdown-columns'
      container.dataset.columnCount = String(
        columns.groups[groupIndex]?.length || 1,
      )
      ;(columns.groups[groupIndex] || []).forEach((block) => {
        const column = document.createElement('div')
        column.className = 'deckdown-column'
        column.innerHTML = marked.parse(block) as string
        container.append(column)
      })
      placeholder.replaceWith(container)
    })
  const markers = [...source.matchAll(/^\s*([-+*])\s+/gm)].map(
    (match) => match[1],
  )
  template.content.querySelectorAll('li').forEach((item, index) => {
    item.setAttribute('data-list-marker', markers[index] || '-')
  })
  return DOMPurify.sanitize(template.innerHTML, {
    ADD_ATTR: ['target', 'rel', 'data-list-marker', 'data-column-count'],
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel|file|data|blob):|[^:]+$)/i,
  })
}

export function markdownAnchor(value: string) {
  const anchor = escapeText(value)
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return anchor || 'slide'
}

function maskManagedToc(source: string) {
  const pattern = new RegExp(
    `${TOC_START}[\\s\\S]*?${TOC_END}(?:\\n{0,2})?`,
  )
  return source.replace(pattern, (block) =>
    block.replace(/[^\n]/g, ' '),
  )
}

export function removeManagedToc(source: string) {
  const pattern = new RegExp(`${TOC_START}[\\s\\S]*?${TOC_END}`)
  return source.replace(pattern, '')
}

function headingEntries(source: string) {
  const counts = new Map<string, number>()
  return [...removeManagedToc(source).matchAll(/^(#{2,3})\s+(.+?)\s*$/gm)].map(
    (match) => {
      const title = escapeText(match[2].trim())
      const base = markdownAnchor(title)
      const count = counts.get(base) || 0
      counts.set(base, count + 1)
      return {
        level: match[1].length,
        title,
        anchor: count ? `${base}-${count + 1}` : base,
      }
    },
  )
}

export function buildManagedToc(source: string) {
  const entries = headingEntries(source).filter((entry) => entry.level === 2)
  const lines = [TOC_START, '## 目录', '']
  entries.forEach((entry) => {
    lines.push(`- [${entry.title}](#${entry.anchor})`)
  })
  if (!entries.length) lines.push('- 暂无章节')
  lines.push(TOC_END)
  return lines.join('\n')
}

export function syncManagedToc(source: string, enabled: boolean) {
  const managedPattern = new RegExp(`${TOC_START}[\\s\\S]*?${TOC_END}`)
  if (!enabled) return source.replace(managedPattern, '')

  const toc = buildManagedToc(source)
  if (managedPattern.test(source)) {
    return source.replace(managedPattern, toc)
  }

  const firstHeading = source.match(/^#\s+.+$/m)
  if (!firstHeading?.index && firstHeading?.index !== 0) {
    return `${toc}\n\n${source}`
  }
  const lineEnd = source.indexOf('\n', firstHeading.index)
  const insertAt = lineEnd < 0 ? source.length : lineEnd
  return `${source.slice(0, insertAt)}\n\n${toc}${source.slice(insertAt)}`
}

function hash(value: string) {
  let result = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(36)
}

function detectKind(markdown: string, fallback: SlideKind = 'content'): SlideKind {
  const trimmed = markdown.trim()
  if (/^>\s+/m.test(trimmed) && trimmed.split('\n').filter(Boolean).length <= 6) {
    return 'quote'
  }
  if (/!\[[^\]]*]\([^)]+\)/.test(trimmed)) return 'image'
  return fallback
}

function splitBlocks(body: string, bodyStart: number): SourceChunk[] {
  const blocks: SourceChunk[] = []
  const lines = body.split('\n')
  let inFence = false
  let blockStart = 0
  let offset = 0

  const pushBlock = (end: number) => {
    const raw = body.slice(blockStart, end)
    const leading = raw.length - raw.trimStart().length
    const trailing = raw.length - raw.trimEnd().length
    if (raw.trim()) {
      blocks.push({
        text: raw.trim(),
        start: bodyStart + blockStart + leading,
        end: bodyStart + end - trailing,
      })
    }
  }

  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    if (!inFence && line.trim() === '') {
      pushBlock(offset)
      blockStart = offset + line.length + (index < lines.length - 1 ? 1 : 0)
    }
    offset += line.length + (index < lines.length - 1 ? 1 : 0)
  })
  pushBlock(body.length)
  return blocks
}

function blockWeight(block: string) {
  const lines = block.split('\n')
  if (/!\[[^\]]*]\([^)]+\)/.test(block)) return 7
  if (/^\s*(```|~~~)/.test(block)) return Math.min(11, 4 + lines.length * 0.55)
  if (/^\s*[-+*]\s+/m.test(block)) return Math.min(12, lines.length * 1.25)
  if (/^\s*\|.+\|\s*$/m.test(block)) return Math.min(12, 4 + lines.length)
  if (/^>\s+/m.test(block)) return 5
  return Math.max(1.5, Math.ceil(block.length / 110) * 1.5)
}

function paginate(section: MarkdownSection, maxWeight = 13): SourceChunk[] {
  if (extractColumnGroups(section.body).groups.length) {
    return [{
      text: section.body,
      start: section.bodyStart,
      end: section.end,
    }]
  }
  const blocks = splitBlocks(section.body, section.bodyStart)
  if (!blocks.length) {
    return [{ text: '', start: section.start, end: section.end }]
  }

  const pages: SourceChunk[] = []
  let current: SourceChunk[] = []
  let weight = 0

  const pushPage = () => {
    if (!current.length) return
    pages.push({
      text: current.map((block) => block.text).join('\n\n'),
      start: current[0].start,
      end: current[current.length - 1].end,
    })
    current = []
    weight = 0
  }

  blocks.forEach((block) => {
    const nextWeight = blockWeight(block.text)
    if (current.length && weight + nextWeight > maxWeight) pushPage()
    current.push(block)
    weight += nextWeight
  })
  pushPage()
  return pages
}

function parseSections(chunk: SourceChunk): MarkdownSection[] {
  const headings: Array<{
    level: number
    title: string
    start: number
    lineEnd: number
  }> = []
  let offset = 0

  chunk.text.split('\n').forEach((line, index, lines) => {
    const match = line.match(headingPattern)
    if (match) {
      headings.push({
        level: match[1].length,
        title: match[2].trim(),
        start: offset,
        lineEnd: offset + line.length + (index < lines.length - 1 ? 1 : 0),
      })
    }
    offset += line.length + (index < lines.length - 1 ? 1 : 0)
  })

  if (!headings.length) {
    return [{
      level: 0,
      title: '',
      body: chunk.text,
      bodyStart: chunk.start,
      text: chunk.text,
      start: chunk.start,
      end: chunk.end,
    }]
  }

  return headings.map((heading, index) => {
    const localEnd = headings[index + 1]?.start ?? chunk.text.length
    const bodyRaw = chunk.text.slice(heading.lineEnd, localEnd)
    const leading = bodyRaw.length - bodyRaw.trimStart().length
    const trailing = bodyRaw.length - bodyRaw.trimEnd().length
    return {
      level: heading.level,
      title: heading.title,
      body: bodyRaw.trim(),
      bodyStart: chunk.start + heading.lineEnd + leading,
      text: chunk.text.slice(heading.start, localEnd),
      start: chunk.start + heading.start,
      end: chunk.start + localEnd - trailing,
    }
  })
}

function createSlide(
  markdown: string,
  kind: SlideKind,
  index: number,
  sourceStart: number,
  sourceEnd: number,
  title?: string,
  continuation?: number,
  level = 3,
  chapter = 0,
): Slide {
  const cleanTitle = title ? escapeText(title) : undefined
  const heading = cleanTitle
    ? `${kind === 'cover' ? '# ' : kind === 'section' || kind === 'toc' ? '## ' : '### '}${cleanTitle}`
    : ''
  const fullMarkdown = [heading, markdown.trim()].filter(Boolean).join('\n\n')
  return {
    id: `slide-${index + 1}`,
    anchor: cleanTitle ? markdownAnchor(cleanTitle) : `slide-${index + 1}`,
    kind: detectKind(fullMarkdown, kind),
    title: cleanTitle,
    level,
    chapter,
    markdown: fullMarkdown,
    html: renderMarkdown(fullMarkdown),
    continuation,
    sourceStart,
    sourceEnd,
  }
}

function compileAutomatic(chunk: SourceChunk, startIndex = 0): Slide[] {
  const sections = parseSections(chunk)
  const slides: Slide[] = []
  let index = startIndex
  let chapter = 0

  sections.forEach((section) => {
    if (section.level === 0) {
      paginate(section).forEach((page) => {
        slides.push(
          createSlide(
            page.text,
            'untitled',
            index++,
            page.start,
            page.end,
            undefined,
            undefined,
            0,
            chapter,
          ),
        )
      })
      return
    }

    if (section.level === 1) {
      const kind: SlideKind = index === 0 ? 'cover' : 'content'
      slides.push(
        createSlide(
          section.body,
          kind,
          index++,
          section.start,
          section.end,
          section.title,
          undefined,
          section.level,
          chapter,
        ),
      )
      return
    }

    if (section.level === 2) {
      chapter += 1
      slides.push(
        createSlide(
          '',
          'section',
          index++,
          section.start,
          section.end,
          section.title,
          undefined,
          section.level,
          chapter,
        ),
      )
      if (section.body) {
        paginate(section).forEach((page) => {
          slides.push(
            createSlide(
              page.text,
              'untitled',
              index++,
              page.start,
              page.end,
              undefined,
              undefined,
              0,
              chapter,
            ),
          )
        })
      }
      return
    }

    paginate(section).forEach((page, pageIndex) => {
      slides.push(
        createSlide(
          page.text,
          'content',
          index++,
          pageIndex === 0 ? section.start : page.start,
          page.end,
          section.title,
          pageIndex || undefined,
          section.level,
          chapter,
        ),
      )
    })
  })

  return slides
}

function createTocSlide(source: string, slides: Slide[]): Slide {
  const lines: string[] = []
  slides.forEach((slide) => {
    if (!slide.title || slide.level !== 2) return
    lines.push(`- [${slide.title}](#${slide.anchor})`)
  })
  return createSlide(
    lines.join('\n') || '- 暂无章节',
    'toc',
    1,
    0,
    Math.min(source.length, source.indexOf('\n') + 1 || source.length),
    '目录',
    undefined,
    1,
    0,
  )
}

export function compileMarkdown(source: string, includeToc = false): Presentation {
  const body = bodyAfterFrontmatter(maskManagedToc(source))
  const firstTitle = body.text.match(/^#\s+(.+)$/m)?.[1] || 'Deckdown'
  const parts = splitAtSeparators(body)
  let offset = 0
  const slides = parts.flatMap((part) => {
    const compiled = compileAutomatic(part, offset)
    offset += compiled.length
    return compiled
  })

  const anchorCounts = new Map<string, number>()
  const anchoredSlides = slides.map((slide) => {
    const anchorBase = slide.title ? markdownAnchor(slide.title) : slide.id
    const anchorCount = anchorCounts.get(anchorBase) || 0
    anchorCounts.set(anchorBase, anchorCount + 1)
    return {
      ...slide,
      anchor: anchorCount ? `${anchorBase}-${anchorCount + 1}` : anchorBase,
    }
  })
  const outputSlides =
    includeToc && anchoredSlides.length > 1
      ? [
          anchoredSlides[0],
          createTocSlide(source, anchoredSlides),
          ...anchoredSlides.slice(1),
        ]
      : anchoredSlides
  let currentChapter = 0
  const normalizedSlides = outputSlides.map((slide, index) => {
    if (slide.kind === 'section') currentChapter += 1
    return {
      ...slide,
      id: `slide-${index + 1}`,
      anchor: slide.kind === 'toc' ? '目录' : slide.anchor,
      chapter:
        slide.kind === 'cover' || slide.kind === 'toc' ? 0 : currentChapter,
    }
  })

  return {
    title: escapeText(firstTitle),
    slides:
      normalizedSlides.length > 0
        ? normalizedSlides
        : [createSlide('开始写一点内容吧。', 'cover', 0, 0, source.length, 'Deckdown', undefined, 1, 0)],
    fingerprint: hash(`${source}:${includeToc}`),
  }
}

export function formatMarkdownStructure(source: string) {
  const normalized = source.replace(/\r\n/g, '\n')
  if (!normalized.trim()) return '# 演示标题\n\n## 第一章\n\n### 内容页\n'

  const sourceHeadings = [...normalized.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)]
  const multiH1 = sourceHeadings.filter((match) => match[1].length === 1).length > 1
  let headingCount = 0
  let hasChapter = false
  let hasContent = false
  const formatted = normalized.split('\n').map((line) => {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (!match) return line.replace(/\s+$/, '')
    headingCount += 1
    if (headingCount === 1) return `# ${match[2]}`
    const originalLevel = match[1].length
    const targetLevel = multiH1
      ? originalLevel === 1
        ? 2
        : 3
      : Math.min(3, Math.max(2, originalLevel))
    if (targetLevel === 2) {
      hasChapter = true
      return `## ${match[2]}`
    }
    hasContent = true
    return `### ${match[2]}`
  })

  if (!headingCount) return `# 演示标题\n\n## 第一章\n\n### 内容页\n\n${formatted.join('\n')}\n`
  if (!hasChapter) formatted.push('', '## 第一章')
  if (!hasContent) formatted.push('', '### 内容页')
  const result = formatted.join('\n')
  return result.endsWith('\n') ? result : `${result}\n`
}

export function slideIndexAtOffset(presentation: Presentation, offset: number) {
  const exact = presentation.slides.findIndex(
    (slide) => offset >= slide.sourceStart && offset <= slide.sourceEnd,
  )
  if (exact >= 0) return exact

  let nearest = 0
  presentation.slides.forEach((slide, index) => {
    if (slide.sourceStart <= offset) nearest = index
  })
  return nearest
}

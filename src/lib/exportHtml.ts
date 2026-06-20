import revealCss from '../../node_modules/reveal.js/dist/reveal.css?raw'
import revealJs from '../../node_modules/reveal.js/dist/reveal.js?raw'
import revealHighlight from '../../node_modules/reveal.js/dist/plugin/highlight.js?raw'
import highlightCss from '../../node_modules/reveal.js/dist/plugin/highlight/monokai.css?raw'
import type { Presentation, PresentationSettings, Slide } from './types'
import { themeStyles, type ThemeName } from './themes'

export interface EmbeddedDeckdownProject {
  format: 'deckdown-html-project'
  version: 1
  markdown: string
  theme: ThemeName
  settings: PresentationSettings
  imageAssets: Record<string, string>
  htmlAssets: Record<string, string>
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const presentationCss = `
  * { box-sizing: border-box; }
  html, body, .reveal-viewport, .reveal {
    background: var(--slide-bg) !important;
  }
  .reveal {
    color: var(--slide-fg);
    font-family: var(--font-body);
    font-size: calc(34px * var(--body-scale));
  }
  .reveal .slides section {
    text-align: left;
    padding: 54px 70px;
    height: 100%;
  }
  .reveal.overview .slides section.present:not(.stack) {
    outline: 14px solid var(--accent);
    outline-offset: 10px;
    box-shadow:
      0 0 0 7px color-mix(in srgb, var(--slide-bg) 88%, transparent),
      0 28px 72px color-mix(in srgb, var(--accent) 34%, transparent) !important;
  }
  .reveal .slides section:not(.slide-cover):not(.slide-section) {
    display: grid !important;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 20px;
  }
  .reveal .slides section.slide-no-title.slide-untitled {
    display: flex !important;
    align-items: center;
    justify-content: center;
  }
  .slide-no-title .slide-title {
    display: none;
  }
  .slide-no-title .slide-body {
    width: 100%;
    height: 100%;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  .slide-no-title .slide-body-inner {
    width: min(920px, 100%);
    margin: auto;
  }
  .slide-title {
    min-width: 0;
  }
  .slide-title > :last-child {
    margin-bottom: 0;
  }
  .slide-body {
    min-width: 0;
    min-height: 0;
    display: flex;
    align-items: center;
    overflow: visible;
  }
  .slide-body-inner {
    width: 100%;
    min-width: 0;
    max-height: 100%;
    transform-origin: center center;
  }
  .slide-body.is-centered .slide-body-inner {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .slide-body.is-centered .media-column {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .slide-body.is-split .slide-body-inner {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: center;
    gap: 48px;
  }
  .slide-body.is-split .text-column,
  .slide-body.is-split .media-column {
    min-width: 0;
  }
  .slide-body.is-split .media-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  .slide-body.is-split .media-column p {
    margin: 0;
    text-align: center;
  }
  .slide-body.is-table-only .slide-body-inner {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .slide-body.is-table-only .table-column {
    width: min(100%, 1060px);
    display: flex;
    justify-content: center;
  }
  .slide-body.is-table-horizontal .slide-body-inner {
    display: grid;
    grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr);
    align-items: center;
    gap: 44px;
  }
  .slide-body.is-table-vertical .slide-body-inner {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    align-items: center;
    gap: 22px;
  }
  .slide-body.is-fixed-columns .slide-body-inner {
    display: block;
  }
  .deckdown-columns {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 44px;
  }
  .deckdown-columns[data-column-count="1"] {
    grid-template-columns: minmax(0, 1fr);
  }
  .deckdown-columns[data-column-count="3"] {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 30px;
  }
  .deckdown-column {
    min-width: 0;
  }
  .deckdown-columns[data-column-count="1"] .deckdown-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .deckdown-columns[data-column-count="1"] .deckdown-column ul,
  .deckdown-columns[data-column-count="1"] .deckdown-column ol {
    display: inline-block;
    text-align: left;
  }
  .deckdown-column > :first-child { margin-top: 0; }
  .deckdown-column > :last-child { margin-bottom: 0; }
  .reveal .deckdown-column img {
    display: block;
    margin-left: auto;
    margin-right: auto;
    max-width: 100%;
    max-height: 430px;
  }
  .reveal .deckdown-column pre {
    align-self: stretch;
    justify-self: stretch;
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
    text-align: left;
  }
  .reveal .deckdown-column pre code {
    text-align: left;
  }
  .reveal .deckdown-column table {
    width: auto;
    max-width: 100%;
    margin-left: auto;
    margin-right: auto;
  }
  .table-column {
    min-width: 0;
    max-height: 100%;
    overflow: visible;
  }
  .table-column table {
    width: 100%;
    margin: 0 auto;
  }
  .reveal h1, .reveal h2, .reveal h3, .reveal h4 {
    color: var(--slide-fg);
    font-family: var(--font-heading);
    text-transform: none;
    letter-spacing: -0.035em;
    line-height: 1.08;
    margin: 0 0 .55em;
  }
  .reveal h1 { font-size: calc(2.25em * var(--heading-scale)); max-width: 900px; }
  .reveal h2 { font-size: calc(1.75em * var(--heading-scale)); }
  .reveal h3 { font-size: calc(1.35em * var(--heading-scale)); padding-bottom: .2em; border-bottom: 3px solid var(--accent-soft); }
  .reveal p { line-height: 1.55; margin: .65em 0; }
  .reveal strong { color: var(--accent); }
  .reveal a {
    color: var(--accent);
    cursor: pointer;
    text-decoration-thickness: .08em;
    text-underline-offset: .18em;
  }
  .reveal a[data-html-asset] {
    display: inline-flex;
    align-items: center;
    gap: .35em;
    border: 2px solid var(--accent-soft);
    border-radius: 999px;
    padding: .35em .7em;
    text-decoration: none;
  }
  .reveal a[data-html-asset]::before { content: "↗"; }
  .reveal ul, .reveal ol { margin-left: 1em; }
  .reveal li { margin: .38em 0; line-height: 1.42; }
  .reveal li::marker { color: var(--accent); }
  .reveal ul.contains-task-list,
  .reveal ul:has(> li > input[type="checkbox"]) {
    margin-left: 0;
    padding-left: 0;
  }
  .reveal li.task-list-item,
  .reveal li:has(> input[type="checkbox"]) {
    position: relative;
    list-style: none;
    padding-left: 1.55em;
  }
  .reveal li.task-list-item > input[type="checkbox"],
  .reveal li > input[type="checkbox"] {
    position: absolute;
    left: 0;
    top: .24em;
    width: .82em;
    height: .82em;
    margin: 0;
    font-size: inherit;
    appearance: none;
    border: .08em solid color-mix(in srgb, var(--accent) 72%, var(--slide-fg));
    border-radius: .22em;
    background: color-mix(in srgb, var(--slide-bg) 88%, var(--accent-soft));
    box-shadow: 0 .08em .18em rgba(0, 0, 0, .12);
    opacity: 1;
  }
  .reveal li.task-list-item > input[type="checkbox"]:checked,
  .reveal li > input[type="checkbox"]:checked {
    border-color: var(--accent);
    background: var(--accent);
  }
  .reveal li.task-list-item > input[type="checkbox"]:checked::after,
  .reveal li > input[type="checkbox"]:checked::after {
    content: "";
    position: absolute;
    left: .21em;
    top: .06em;
    width: .2em;
    height: .4em;
    border: solid var(--slide-bg);
    border-width: 0 .1em .1em 0;
    transform: rotate(45deg);
  }
  .reveal blockquote {
    width: min(76%, 900px);
    margin: 1.1em auto;
    padding: .8em 1em;
    border-left: 8px solid var(--accent);
    border-radius: 18px;
    background: var(--accent-soft);
    color: var(--slide-fg);
    box-shadow: none;
    font-family: var(--font-heading);
    font-size: 1.18em;
    font-style: normal;
  }
  .reveal pre {
    position: relative;
    width: 100%;
    margin: .8em 0;
    padding-top: 38px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,.11);
    border-radius: 14px;
    background: #272822;
    box-shadow: 0 14px 38px rgba(0,0,0,.22);
  }
  .reveal pre::before {
    content: "";
    position: absolute;
    top: 15px;
    left: 18px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ff5f57;
    box-shadow: 18px 0 #febc2e, 36px 0 #28c840;
  }
  .reveal pre code {
    max-height: 540px;
    padding: 20px 26px 25px;
    border-radius: 0;
    background: #272822;
    color: #f8f8f2;
    font-family: "SFMono-Regular", "Cascadia Code", "JetBrains Mono", monospace;
    font-size: .58em;
    line-height: 1.58;
    tab-size: 2;
  }
  .reveal code { color: var(--accent); }
  .reveal img {
    width: auto;
    max-height: 570px;
    max-width: 100%;
    object-fit: contain;
    border-radius: 18px;
    box-shadow: none;
  }
  .reveal.has-image-shadow img {
    box-shadow: 0 22px 52px -14px rgba(0,0,0,.24);
  }
  .reveal .media-column iframe,
  .reveal .deckdown-column iframe {
    display: block;
    max-width: 100%;
    aspect-ratio: 16 / 9;
    max-height: 540px;
    border: 0;
    border-radius: 16px;
    background: #000;
    box-shadow: 0 18px 48px rgba(0,0,0,.24);
  }
  .reveal .media-column iframe:not([width]),
  .reveal .deckdown-column iframe:not([width]) {
    width: min(100%, 960px);
  }
  .reveal .slide-body.is-split .media-column iframe:not([width]) {
    width: 100%;
  }
  .reveal table { font-size: .72em; }
  .reveal table th {
    background: var(--accent);
    color: var(--slide-bg);
  }
  .reveal table th, .reveal table td { padding: .45em .6em; }
  .reveal.theme-custom .slide-cover { background: var(--cover-pattern); }
  .reveal.theme-custom h3 { border-bottom-color: transparent; }
  .reveal.theme-custom blockquote,
  .reveal.theme-custom pre,
  .reveal.theme-custom img {
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  .reveal.theme-custom pre::before { display: none; }
  .reveal.theme-custom pre code,
  .reveal.theme-custom blockquote {
    color: inherit;
    background: transparent;
  }
  .reveal.theme-custom.has-image-shadow img {
    box-shadow: 0 22px 52px -14px rgba(0,0,0,.24);
  }
  .reveal.theme-custom li::marker { color: inherit; }
  .reveal.theme-custom table th {
    color: inherit;
    background: transparent;
  }
  .reveal .slide-cover {
    display: flex !important;
    flex-direction: column;
    justify-content: center;
    background: var(--cover-pattern);
  }
  .reveal .slide-cover p { color: var(--muted); max-width: 780px; }
  .reveal .slide-section {
    display: flex !important;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 70px 110px !important;
    text-align: center;
  }
  .reveal .slide-section h2 { font-size: calc(2.2em * var(--heading-scale)); }
  .reveal .slide-section p { color: var(--muted); }
  .reveal .slide-toc {
    display: flex !important;
    flex-direction: column;
    justify-content: center;
    padding: 70px 110px !important;
  }
  .reveal .slide-toc .slide-title { text-align: center; }
  .reveal .slide-toc h2 { margin-bottom: .7em; text-align: center; }
  .reveal .slide-toc .slide-body { justify-content: center; }
  .reveal .slide-toc > .slide-body .slide-body-inner > ul {
    width: fit-content;
    max-width: min(920px, 100%);
    margin: 0 auto;
    list-style: disc;
    text-align: left;
  }
  .reveal .slide-toc li { padding: .22em 0; }
  .reveal .slide-quote .slide-body { justify-content: center; }
  .reveal .slide-quote blockquote { font-size: 1.45em; }
  .reveal .slide-image img {
    display: block;
    margin: 0 auto;
    max-height: 540px;
    max-width: 100%;
  }
  .reveal .slide-image .slide-body.is-split img {
    max-height: 480px;
  }
  .reveal img[data-fixed-size="true"] {
    flex: 0 0 auto;
  }
  .continuation {
    color: var(--muted);
    font-family: var(--font-body);
    font-size: .35em;
    letter-spacing: normal;
    vertical-align: middle;
  }
  .reveal .progress { color: var(--accent); height: 4px; }
  .reveal .controls {
    color: var(--accent);
    transform: scale(.72);
    transform-origin: bottom right;
  }
  .reveal[data-navigation-mode="linear"] .controls .navigate-up,
  .reveal[data-navigation-mode="linear"] .controls .navigate-down {
    display: none;
  }
  .reveal .slide-number {
    background: transparent;
    color: var(--muted);
    font: 15px var(--font-body);
  }
  .reveal .slide-number a {
    color: inherit;
    text-decoration: none;
  }
  .drawing-layer {
    position: fixed;
    inset: 0;
    z-index: 900;
    width: 100%;
    height: 100%;
    pointer-events: none;
    touch-action: none;
  }
  .drawing-layer.is-active {
    pointer-events: auto;
    cursor: crosshair;
  }
  .drawing-layer.is-eraser {
    cursor: cell;
  }
  .drawing-tools {
    position: fixed;
    z-index: 910;
    left: 50%;
    bottom: 14px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }
  .drawing-tools button {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 8px;
    padding: 0;
    color: var(--slide-fg);
    background: transparent;
    cursor: pointer;
  }
  .drawing-tools button svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.9;
  }
  .drawing-tools button:hover,
  .drawing-tools button.is-active {
    color: var(--slide-bg);
    background: var(--accent);
  }
  .drawing-colors {
    display: none;
    align-items: center;
    gap: 4px;
    margin-left: 3px;
  }
  .drawing-tools.is-pen .drawing-colors {
    display: flex;
  }
  .drawing-tools .drawing-color {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border: 2px solid var(--slide-bg);
    border-radius: 50%;
    padding: 0;
    background: var(--drawing-color);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--slide-fg) 28%, transparent);
    cursor: pointer;
  }
  .drawing-tools .drawing-color:hover,
  .drawing-tools .drawing-color.is-active {
    color: transparent;
    background: var(--drawing-color);
    box-shadow:
      0 0 0 2px var(--slide-bg),
      0 0 0 4px var(--accent);
  }
  @media print {
    .drawing-layer,
    .drawing-tools { display: none !important; }
  }
  .reveal.is-preview .slide-number {
    pointer-events: none;
    cursor: default;
  }
  .web-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: none;
    background: #f7f7f7;
  }
  .web-overlay.is-open { display: block; }
  .web-overlay-back {
    position: absolute;
    z-index: 2;
    top: 18px;
    right: 18px;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(255,255,255,.35);
    border-radius: 8px;
    padding: 0;
    color: #fff;
    background: rgba(31,31,31,.78);
    box-shadow: 0 8px 24px rgba(0,0,0,.28);
    font: 600 18px/1 system-ui, sans-serif;
    cursor: pointer;
    backdrop-filter: blur(8px);
  }
  .web-overlay-back:hover { background: rgba(183,71,42,.94); }
  .web-overlay iframe { width: 100%; height: 100%; border: 0; background: #fff; }
  @media print {
    .reveal .slides section { padding: 54px 70px !important; }
  }
`

function applyProgressiveReveal(root: HTMLElement) {
  // Record source order before the layout code moves media into separate columns.
  const orderedElements: Element[] = []
  root.querySelectorAll(':scope > *').forEach((element) => {
    if (element.classList.contains('deckdown-columns')) {
      element
        .querySelectorAll(':scope > .deckdown-column')
        .forEach((column) => orderedElements.push(...column.children))
      return
    }
    orderedElements.push(element)
  })

  let fragmentIndex = 0
  let followsProgressiveList = false
  const addFragment = (element: Element) => {
    element.classList.add('fragment', 'fade-up')
    element.setAttribute('data-fragment-index', String(fragmentIndex))
    fragmentIndex += 1
  }

  orderedElements.forEach((element) => {
    const progressiveItems = [
      ...element.querySelectorAll(
        'ol > li, li[data-list-marker="+"], li[data-list-marker="*"]',
      ),
    ]

    if (progressiveItems.length) {
      progressiveItems.forEach(addFragment)
      followsProgressiveList = true
    } else if (followsProgressiveList) {
      addFragment(element)
    }
  })
}

export function buildPresentationHtml(
  presentation: Presentation,
  theme: ThemeName,
  isPreview = false,
  imageAssets: Record<string, string> = {},
  settings: PresentationSettings = {
    includeToc: false,
    progressiveReveal: false,
    imageShadow: true,
    navigationControls: true,
    enableDrawing: false,
    verticalSubpages: true,
    ratio: '16:9',
    headingFont: '',
    bodyFont: '',
    headingScale: 1,
    bodyScale: 1,
    componentStyles: {
      list: '',
      code: '',
      quote: '',
      table: '',
      image: '',
    },
    themeCss: {},
  },
  htmlAssets: Record<string, string> = {},
  projectData?: EmbeddedDeckdownProject,
) {
  const resolveImages = (html: string) =>
    html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/g, (full, before, source, after) => {
      const decoded = (() => {
        try {
          return decodeURIComponent(source)
        } catch {
          return source
        }
      })()
      return imageAssets[source] || imageAssets[decoded]
        ? `${before}${imageAssets[source] || imageAssets[decoded]}${after}`
        : full
    })

  const buildSlideLayout = (rawHtml: string, kind: string) => {
    const template = document.createElement('template')
    template.innerHTML = rawHtml.trim()
    const root = document.createElement('div')
    root.append(template.content.cloneNode(true))

    root.querySelectorAll('img').forEach((image) => {
      const alt = image.getAttribute('alt') || ''
      const size = alt.match(/\|(\d+)(?:x(\d+))?\s*$/)
      if (!size) return
      image.alt = alt.slice(0, size.index).trim()
      image.dataset.fixedSize = 'true'
      image.style.width = `${size[1]}px`
      if (size[2]) {
        image.style.height = `${size[2]}px`
        image.style.objectFit = 'contain'
      }
    })
    root.querySelectorAll('iframe').forEach((iframe) => {
      const width = iframe.getAttribute('width')?.trim()
      if (width && /^(?:\d+(?:\.\d+)?(?:px|%|rem|em|vw)?|auto)$/i.test(width)) {
        iframe.style.width = /^\d+(?:\.\d+)?$/.test(width)
          ? `${width}px`
          : width
      }
    })

    if (settings.progressiveReveal) applyProgressiveReveal(root)

    const heading = root.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4')
    const titleHtml = heading?.outerHTML || ''
    heading?.remove()

    if (kind === 'cover' || kind === 'section') {
      return `${titleHtml}${root.innerHTML}`
    }

    if (root.querySelector(':scope > .deckdown-columns')) {
      return `<div class="slide-title">${titleHtml}</div>
        <div class="slide-body is-fixed-columns">
          <div class="slide-body-inner">${root.innerHTML}</div>
        </div>`
    }

    const imageNodes = [...root.querySelectorAll('img')]
    const iframeNodes = [...root.querySelectorAll('iframe')]
    const tableNodes = [...root.querySelectorAll('table')]
    const mediaContainers = new Set<Element>()
    imageNodes.forEach((image) => {
      const parent = image.parentElement
      mediaContainers.add(parent?.tagName === 'P' ? parent : image)
    })
    iframeNodes.forEach((iframe) => {
      const parent = iframe.parentElement
      mediaContainers.add(parent?.tagName === 'P' ? parent : iframe)
    })

    const textRoot = root.cloneNode(true) as HTMLElement
    textRoot.querySelectorAll('img').forEach((image) => {
      const parent = image.parentElement
      if (parent?.tagName === 'P' && parent.textContent?.trim() === '') parent.remove()
      else image.remove()
    })
    textRoot.querySelectorAll('iframe').forEach((iframe) => {
      const parent = iframe.parentElement
      if (parent?.tagName === 'P' && parent.textContent?.trim() === '') parent.remove()
      else iframe.remove()
    })
    textRoot.querySelectorAll('table').forEach((table) => table.remove())
    const hasText = Boolean(
      textRoot.textContent?.trim() ||
        textRoot.querySelector('pre, blockquote, ul, ol, hr'),
    )
    const hasImages = imageNodes.length > 0
    const hasMedia = hasImages || iframeNodes.length > 0
    const hasTables = tableNodes.length > 0

    let bodyClass = ''
    let bodyHtml = root.innerHTML
    if (hasTables) {
      const tableHtml = tableNodes.map((table) => table.outerHTML).join('')
      const mediaHtml = [...mediaContainers]
        .map((node) => node.outerHTML)
        .join('')
      const tableMediaHtml = `${tableHtml}${mediaHtml}`
      const widestColumns = Math.max(
        0,
        ...tableNodes.map(
          (table) => table.querySelector('tr')?.children.length || 0,
        ),
      )
      const totalRows = Math.max(
        0,
        ...tableNodes.map((table) => table.querySelectorAll('tr').length),
      )
      if (!hasText && !hasMedia) {
        bodyClass = ' is-table-only'
        bodyHtml = `<div class="table-column">${tableHtml}</div>`
      } else if (widestColumns >= 4 || widestColumns >= totalRows) {
        bodyClass = ' is-table-vertical'
        bodyHtml = `<div class="text-column">${textRoot.innerHTML}</div>
          <div class="table-column">${tableMediaHtml}</div>`
      } else {
        bodyClass = ' is-table-horizontal'
        bodyHtml = `<div class="text-column">${textRoot.innerHTML}</div>
          <div class="table-column">${tableMediaHtml}</div>`
      }
    } else if (hasMedia && !hasText) {
      bodyClass = ' is-centered'
      bodyHtml = `<div class="media-column">${[...mediaContainers]
        .map((node) => node.outerHTML)
        .join('')}</div>`
    } else if (hasMedia && hasText) {
      bodyClass = ' is-split'
      bodyHtml = `<div class="text-column">${textRoot.innerHTML}</div>
        <div class="media-column">${[...mediaContainers]
          .map((node) => node.outerHTML)
          .join('')}</div>`
    }

    return `<div class="slide-title">${titleHtml}</div>
      <div class="slide-body${bodyClass}">
        <div class="slide-body-inner">${bodyHtml}</div>
      </div>`
  }

  const resolveHtmlLinks = (html: string) =>
    html.replace(
      /(<a\b[^>]*\bhref=")([^"]+)(")/g,
      (full, before, source, after) =>
        htmlAssets[source]
          ? `${before}#embedded-html${after} data-html-asset="${escapeHtml(source)}"`
          : full,
    )

  const renderSlide = (slide: Slide, flatIndex: number) => `
        <section id="${escapeHtml(slide.anchor)}" class="slide-${slide.kind} ${slide.title ? 'slide-has-title' : 'slide-no-title'}" data-slide-index="${flatIndex}" data-transition="fade">
          ${buildSlideLayout(resolveHtmlLinks(resolveImages(
            slide.continuation && slide.title
              ? slide.html.replace(
                  /(<h3[^>]*>)(.*?)(<\/h3>)/,
                  `$1$2 <span class="continuation">· 续 ${slide.continuation + 1}</span>$3`,
                )
              : slide.html,
          )), slide.kind)}
        </section>`

  const groups: string[] = []
  let cursor = 0
  while (cursor < presentation.slides.length) {
    const slide = presentation.slides[cursor]
    if (slide.kind === 'section') {
      const vertical = [slide]
      let next = cursor + 1
      while (
        next < presentation.slides.length &&
        presentation.slides[next].chapter === slide.chapter &&
        presentation.slides[next].kind !== 'section'
      ) {
        vertical.push(presentation.slides[next])
        next += 1
      }
      groups.push(
        vertical.length > 1
          ? `<section>${vertical
              .map((item) => renderSlide(item, presentation.slides.indexOf(item)))
              .join('\n')}</section>`
          : renderSlide(slide, cursor),
      )
      cursor = next
    } else {
      groups.push(renderSlide(slide, cursor))
      cursor += 1
    }
  }
  const slides = groups.join('\n')
  const [width, height] = settings.ratio === '4:3' ? [960, 720] : [1280, 720]
  const fontOverrides = `
    --heading-scale: ${settings.headingScale};
    --body-scale: ${settings.bodyScale};
    ${settings.headingFont ? `--font-heading: ${settings.headingFont};` : ''}
    ${settings.bodyFont ? `--font-body: ${settings.bodyFont};` : ''}
  `
  const serializedHtmlAssets = JSON.stringify(htmlAssets).replace(
    /</g,
    '\\u003c',
  )
  const serializedProjectData = projectData
    ? JSON.stringify(projectData).replace(/</g, '\\u003c')
    : ''
  const customComponentCss = Object.values(settings.componentStyles || {})
    .join('\n')
    .replace(/<\/style/gi, '<\\/style')
  const customThemeCss = (settings.themeCss?.[theme] || '').replace(
    /<\/style/gi,
    '<\\/style',
  )

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="Deckdown">
  <title>${escapeHtml(presentation.title)}</title>
  <style>${revealCss}</style>
  <style>${highlightCss}</style>
  <style>:root { ${themeStyles[theme]} ${fontOverrides} }</style>
  <style>${presentationCss}</style>
  <style id="deckdown-theme-styles">${customThemeCss}</style>
  <style id="deckdown-component-styles">${customComponentCss}</style>
</head>
<body>
  ${
    projectData
      ? `<script id="deckdown-project-data" type="application/json">${serializedProjectData}</script>`
      : ''
  }
  <div class="reveal theme-${theme}${settings.imageShadow ? ' has-image-shadow' : ''}${isPreview ? ' is-preview' : ''}">
    <div class="slides">${slides}</div>
  </div>
  ${
    settings.enableDrawing
      ? `<canvas class="drawing-layer" id="drawing-layer" aria-label="自由绘图画布"></canvas>
  <div class="drawing-tools" id="drawing-tools">
    <button type="button" id="drawing-pen" title="画笔（D）" aria-label="画笔">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m15 5 4 4"></path>
        <path d="M13 7 4.5 15.5 3 21l5.5-1.5L17 11"></path>
        <path d="m14 6 2-2a2 2 0 0 1 3 3l-2 2"></path>
      </svg>
    </button>
    <button type="button" id="drawing-eraser" title="橡皮擦（E）" aria-label="橡皮擦">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m7 21-4-4a2 2 0 0 1 0-3L13.5 3.5a2 2 0 0 1 3 0l4 4a2 2 0 0 1 0 3L10 21"></path>
        <path d="m6 11 7 7"></path>
        <path d="M7 21h14"></path>
      </svg>
    </button>
    <div class="drawing-colors" id="drawing-colors" aria-label="画笔颜色">
      <button type="button" class="drawing-color" data-drawing-color="#222222" style="--drawing-color:#222222" title="黑色" aria-label="黑色"></button>
      <button type="button" class="drawing-color" data-drawing-color="#d34b32" style="--drawing-color:#d34b32" title="红色" aria-label="红色"></button>
      <button type="button" class="drawing-color" data-drawing-color="#2266ff" style="--drawing-color:#2266ff" title="蓝色" aria-label="蓝色"></button>
      <button type="button" class="drawing-color" data-drawing-color="#20a65a" style="--drawing-color:#20a65a" title="绿色" aria-label="绿色"></button>
      <button type="button" class="drawing-color" data-drawing-color="#ff9f1c" style="--drawing-color:#ff9f1c" title="橙色" aria-label="橙色"></button>
      <button type="button" class="drawing-color" data-drawing-color="#8b3dff" style="--drawing-color:#8b3dff" title="紫色" aria-label="紫色"></button>
    </div>
  </div>`
      : ''
  }
  <div class="web-overlay" id="web-overlay">
    <button class="web-overlay-back" type="button" title="返回幻灯片" aria-label="返回幻灯片">×</button>
    <iframe id="web-overlay-frame" title="插入的网页"></iframe>
  </div>
  <script>${revealJs}</script>
  <script>${revealHighlight}</script>
  <script>
    Reveal.initialize({
      hash: ${isPreview ? 'false' : 'true'},
      navigationMode: '${settings.verticalSubpages ? 'default' : 'linear'}',
      controls: ${settings.navigationControls ? 'true' : 'false'},
      progress: ${settings.navigationControls ? 'true' : 'false'},
      slideNumber: 'c/t',
      center: false,
      transition: 'fade',
      backgroundTransition: 'fade',
      width: ${width},
      height: ${height},
      margin: 0,
      minScale: 0.15,
      maxScale: 2,
      plugins: [RevealHighlight]
    });
    function fitSlideBody(slide) {
      if (!slide) return;
      const body = slide.querySelector('.slide-body');
      const inner = body && body.querySelector('.slide-body-inner');
      if (!body || !inner) return;

      inner.style.fontSize = '';
      inner.style.transform = '';
      inner.dataset.fitScale = '1';
      const images = Array.from(inner.querySelectorAll('img'));
      images.forEach(function (image) {
        if (!image.dataset.fixedSize) image.style.maxHeight = '';
      });

      const availableHeight = body.clientHeight;
      const availableWidth = body.clientWidth;
      if (!availableHeight || !availableWidth) return;

      let scale = 1;
      const overflows = function () {
        return inner.scrollHeight > availableHeight + 2 ||
          inner.scrollWidth > availableWidth + 2;
      };

      while (overflows() && scale > 0.62) {
        scale = Math.max(0.62, scale - 0.04);
        inner.style.fontSize = scale + 'em';
        images.forEach(function (image) {
          if (!image.dataset.fixedSize) {
            image.style.maxHeight = Math.floor(availableHeight * scale) + 'px';
          }
        });
      }

      if (overflows()) {
        const heightScale = availableHeight / Math.max(inner.scrollHeight, 1);
        const widthScale = availableWidth / Math.max(inner.scrollWidth, 1);
        const transformScale = Math.max(0.72, Math.min(1, heightScale, widthScale));
        inner.style.transform = 'scale(' + transformScale + ')';
        inner.dataset.fitScale = String(scale * transformScale);
      } else {
        inner.dataset.fitScale = String(scale);
      }
    }
    function fitAllSlides() {
      document.querySelectorAll('.reveal .slides > section').forEach(fitSlideBody);
    }
    Reveal.on('ready', function () {
      requestAnimationFrame(function () {
        fitAllSlides();
        setTimeout(fitAllSlides, 120);
      });
      if (${isPreview ? 'true' : 'false'} && window.parent !== window) {
        window.parent.postMessage({ type: 'ready-slides:ready' }, '*');
      }
    });
    Reveal.on('slidechanged', function (event) {
      requestAnimationFrame(function () { fitSlideBody(event.currentSlide); });
    });
    window.addEventListener('resize', function () {
      requestAnimationFrame(fitAllSlides);
    });
    ${
      settings.enableDrawing
        ? `
    var drawingCanvas = document.getElementById('drawing-layer');
    var drawingTools = document.getElementById('drawing-tools');
    var drawingPen = document.getElementById('drawing-pen');
    var drawingEraser = document.getElementById('drawing-eraser');
    var drawingColorButtons = Array.from(
      document.querySelectorAll('[data-drawing-color]')
    );
    var drawingContext = drawingCanvas.getContext('2d');
    var drawingMode = 'off';
    var currentStroke = null;
    var slideDrawings = {};
    var drawingColorValue = '#d34b32';
    function setDrawingColor(color, activate) {
      drawingColorValue = color;
      drawingColorButtons.forEach(function (button) {
        button.classList.toggle(
          'is-active',
          button.getAttribute('data-drawing-color') === color
        );
      });
      if (activate !== false) setDrawingMode('pen');
    }
    function drawingSlideKey() {
      var indices = Reveal.getIndices();
      return String(indices.h || 0) + '/' + String(indices.v || 0);
    }
    function resizeDrawingCanvas() {
      var ratio = window.devicePixelRatio || 1;
      drawingCanvas.width = Math.round(window.innerWidth * ratio);
      drawingCanvas.height = Math.round(window.innerHeight * ratio);
      drawingCanvas.style.width = window.innerWidth + 'px';
      drawingCanvas.style.height = window.innerHeight + 'px';
      drawingContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      redrawDrawingCanvas();
    }
    function redrawDrawingCanvas() {
      drawingContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
      drawingContext.lineCap = 'round';
      drawingContext.lineJoin = 'round';
      drawingContext.lineWidth = 3;
      (slideDrawings[drawingSlideKey()] || []).forEach(function (stroke) {
        if (!stroke.points.length) return;
        drawingContext.strokeStyle = stroke.color;
        drawingContext.beginPath();
        drawingContext.moveTo(
          stroke.points[0].x * window.innerWidth,
          stroke.points[0].y * window.innerHeight
        );
        stroke.points.slice(1).forEach(function (point) {
          drawingContext.lineTo(
            point.x * window.innerWidth,
            point.y * window.innerHeight
          );
        });
        drawingContext.stroke();
      });
    }
    function setDrawingMode(mode) {
      drawingMode = mode;
      currentStroke = null;
      drawingCanvas.classList.toggle('is-active', mode !== 'off');
      drawingCanvas.classList.toggle('is-eraser', mode === 'eraser');
      drawingPen.classList.toggle('is-active', mode === 'pen');
      drawingEraser.classList.toggle('is-active', mode === 'eraser');
      drawingTools.classList.toggle('is-pen', mode === 'pen');
    }
    function drawingPoint(event) {
      return {
        x: event.clientX / Math.max(window.innerWidth, 1),
        y: event.clientY / Math.max(window.innerHeight, 1)
      };
    }
    function eraseAt(point) {
      var strokes = slideDrawings[drawingSlideKey()] || [];
      var radius = 22;
      slideDrawings[drawingSlideKey()] = strokes.filter(function (stroke) {
        return !stroke.points.some(function (candidate) {
          var dx = (candidate.x - point.x) * window.innerWidth;
          var dy = (candidate.y - point.y) * window.innerHeight;
          return Math.sqrt(dx * dx + dy * dy) <= radius;
        });
      });
      redrawDrawingCanvas();
    }
    drawingCanvas.addEventListener('pointerdown', function (event) {
      if (drawingMode === 'off') return;
      event.preventDefault();
      drawingCanvas.setPointerCapture(event.pointerId);
      var point = drawingPoint(event);
      if (drawingMode === 'eraser') {
        eraseAt(point);
        return;
      }
      currentStroke = {
        color: drawingColorValue,
        points: [point]
      };
      var key = drawingSlideKey();
      slideDrawings[key] = slideDrawings[key] || [];
      slideDrawings[key].push(currentStroke);
    });
    drawingCanvas.addEventListener('pointermove', function (event) {
      if (drawingMode === 'off') return;
      event.preventDefault();
      var point = drawingPoint(event);
      if (drawingMode === 'eraser') {
        eraseAt(point);
        return;
      }
      if (!currentStroke) return;
      currentStroke.points.push(point);
      redrawDrawingCanvas();
    });
    drawingCanvas.addEventListener('pointerup', function (event) {
      if (!currentStroke) return;
      event.preventDefault();
      currentStroke = null;
    });
    drawingCanvas.addEventListener('pointercancel', function () {
      currentStroke = null;
    });
    drawingPen.addEventListener('click', function () {
      setDrawingMode(drawingMode === 'pen' ? 'off' : 'pen');
    });
    drawingEraser.addEventListener('click', function () {
      setDrawingMode(drawingMode === 'eraser' ? 'off' : 'eraser');
    });
    drawingColorButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        setDrawingColor(button.getAttribute('data-drawing-color'), true);
      });
    });
    document.addEventListener('keydown', function (event) {
      var key = event.key.toLowerCase();
      if (key === 'd' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setDrawingMode(drawingMode === 'pen' ? 'off' : 'pen');
      } else if (key === 'e' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setDrawingMode(drawingMode === 'eraser' ? 'off' : 'eraser');
      } else if (event.key === 'Escape' && drawingMode !== 'off') {
        event.preventDefault();
        event.stopImmediatePropagation();
        setDrawingMode('off');
      }
    }, true);
    Reveal.on('slidechanged', function () {
      currentStroke = null;
      setDrawingMode('off');
      redrawDrawingCanvas();
    });
    window.addEventListener('resize', resizeDrawingCanvas);
    setDrawingColor(drawingColorValue, false);
    resizeDrawingCanvas();
    `
        : ''
    }
    var webOverlay = document.getElementById('web-overlay');
    var webFrame = document.getElementById('web-overlay-frame');
    var embeddedHtmlAssets = ${serializedHtmlAssets};
    function closeWebOverlay() {
      webOverlay.classList.remove('is-open');
      webFrame.removeAttribute('srcdoc');
      webFrame.src = 'about:blank';
    }
    function handleOverlayShortcut(event) {
      if (
        event.key === 'Escape' &&
        event.shiftKey &&
        webOverlay.classList.contains('is-open')
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeWebOverlay();
      }
    }
    function decodeHtmlDataUrl(url) {
      var match = url.match(/^data:text\\/html(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
      if (!match) return null;
      try {
        return match[1]
          ? decodeURIComponent(escape(atob(match[2])))
          : decodeURIComponent(match[2]);
      } catch (error) {
        return null;
      }
    }
    document.querySelector('.web-overlay-back').addEventListener('click', closeWebOverlay);
    document.addEventListener('keydown', handleOverlayShortcut, true);
    webFrame.addEventListener('load', function () {
      try {
        webFrame.contentWindow.addEventListener('keydown', handleOverlayShortcut, true);
      } catch (error) {
        // Cross-origin webpages still retain the visible floating close button.
      }
    });
    document.addEventListener('click', function (event) {
      var link = event.target.closest && event.target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href') || '';
      var assetPath = link.getAttribute('data-html-asset');
      if (assetPath && embeddedHtmlAssets[assetPath]) {
        event.preventDefault();
        event.stopImmediatePropagation();
        var assetHtml = decodeHtmlDataUrl(embeddedHtmlAssets[assetPath]);
        if (assetHtml === null) return;
        webFrame.src = 'about:blank';
        webFrame.srcdoc = assetHtml;
        webOverlay.classList.add('is-open');
        return;
      }
      if (/^(https?:|file:|data:text\\/html|\\.\\.?\\/|[^#]+\\.html(?:[?#]|$))/i.test(href)) {
        event.preventDefault();
        var embeddedHtml = decodeHtmlDataUrl(href);
        if (embeddedHtml !== null) {
          webFrame.src = 'about:blank';
          webFrame.srcdoc = embeddedHtml;
        } else {
          webFrame.removeAttribute('srcdoc');
          webFrame.src = href;
        }
        webOverlay.classList.add('is-open');
        return;
      }
      if (href.charAt(0) === '#') {
        var target = document.getElementById(decodeURIComponent(href.slice(1)));
        if (target && target.matches('section')) {
          event.preventDefault();
          var targetIndices = Reveal.getIndices(target);
          Reveal.slide(targetIndices.h, targetIndices.v);
        }
      }
    }, true);
    ${
      isPreview
        ? `
    document.addEventListener('click', function (event) {
      const link = event.target.closest && event.target.closest('a[href^="#"]');
      if (!link) return;
      event.preventDefault();
      const href = link.getAttribute('href') || '';
      const revealTarget = href.match(/^#\\/(\\d+)(?:\\/(\\d+))?$/);
      if (revealTarget) {
        Reveal.slide(Number(revealTarget[1]), Number(revealTarget[2] || 0));
        return;
      }
      const target = document.getElementById(href.slice(1));
      if (target && target.matches('section')) {
        const indices = Reveal.getIndices(target);
        Reveal.slide(indices.h, indices.v);
      }
    }, true);
    window.addEventListener('message', function (event) {
      if (!event.data || event.data.type !== 'ready-slides:go-to') return;
      var target = document.querySelector('[data-slide-index="' + (Number(event.data.index) || 0) + '"]');
      if (!target) return;
      var indices = Reveal.getIndices(target);
      Reveal.slide(indices.h, indices.v);
    });
    `
        : ''
    }
  </script>
</body>
</html>`
}

import PptxGenJS from 'pptxgenjs'
import type {
  Presentation,
  PresentationSettings,
  Slide,
  SlideRatio,
} from './types'
import type { ThemeName } from './themes'

interface Palette {
  background: string
  foreground: string
  muted: string
  accent: string
  accentSoft: string
  code: string
}

const palettes: Record<ThemeName, Palette> = {
  paper: {
    background: 'F8F5ED',
    foreground: '22211E',
    muted: '706D65',
    accent: 'B85C3F',
    accentSoft: 'E7D8C8',
    code: 'EAE5DA',
  },
  midnight: {
    background: '111318',
    foreground: 'F3F0E9',
    muted: 'AAA69E',
    accent: 'FFCA68',
    accentSoft: '3B3427',
    code: '20232B',
  },
  ocean: {
    background: 'EDF6F5',
    foreground: '153B42',
    muted: '53747A',
    accent: '0D8493',
    accentSoft: 'C9E4E2',
    code: 'DBECEB',
  },
  warm: {
    background: 'FFF0E2',
    foreground: '3D2926',
    muted: '80615A',
    accent: 'DF5D4F',
    accentSoft: 'F1C6A9',
    code: 'F2DDCE',
  },
  custom: {
    background: 'FFFFFF',
    foreground: '111111',
    muted: '666666',
    accent: '111111',
    accentSoft: 'EEEEEE',
    code: 'F5F5F5',
  },
}

function plainText(element: Element) {
  return (element.textContent || '').replace(/\s+/g, ' ').trim()
}

function safeFont(font: string, fallback: string) {
  const first = font.split(',')[0]?.replace(/["']/g, '').trim()
  if (!first || /system-ui|sans-serif|serif|monospace/i.test(first)) {
    return fallback
  }
  return first
}

function linkFor(
  element: Element,
  anchorSlides: Map<string, number>,
) {
  const link = element.closest('a[href]') || element.querySelector('a[href]')
  if (!link) return undefined
  const href = link.getAttribute('data-html-asset') || link.getAttribute('href')
  if (!href) return undefined
  if (href.startsWith('#')) {
    const slide = anchorSlides.get(decodeURIComponent(href.slice(1)))
    return slide ? { slide } : undefined
  }
  return { url: href }
}

function addDecorations(
  pptx: PptxGenJS,
  slide: ReturnType<PptxGenJS['addSlide']>,
  kind: Slide['kind'],
  palette: Palette,
  width: number,
  height: number,
) {
  slide.background = { color: palette.background }
  if (kind === 'cover') {
    slide.addShape(pptx.ShapeType.ellipse, {
      x: width - 2.2,
      y: 0.45,
      w: 1.15,
      h: 1.15,
      fill: { color: palette.accentSoft },
      line: { color: palette.accentSoft, transparency: 100 },
    })
    slide.addShape(pptx.ShapeType.rect, {
      x: width - 3.25,
      y: 0,
      w: 3.25,
      h: height,
      rotate: 0,
      fill: { color: palette.accentSoft, transparency: 22 },
      line: { color: palette.accentSoft, transparency: 100 },
    })
  }
}

function addTitle(
  pptx: PptxGenJS,
  slide: ReturnType<PptxGenJS['addSlide']>,
  title: string,
  kind: Slide['kind'],
  palette: Palette,
  width: number,
  headingFont: string,
  headingScale: number,
) {
  if (kind === 'cover') {
    slide.addText(title, {
      x: 0.8,
      y: 2.15,
      w: width - 2.1,
      h: 1.35,
      fontFace: headingFont,
      fontSize: 38 * headingScale,
      bold: true,
      color: palette.foreground,
      margin: 0,
      breakLine: false,
    })
    return
  }
  if (kind === 'section') {
    slide.addText(title, {
      x: 1,
      y: 2.75,
      w: width - 2,
      h: 0.9,
      fontFace: headingFont,
      fontSize: 34 * headingScale,
      bold: true,
      align: 'center',
      color: palette.foreground,
      margin: 0,
    })
    return
  }
  slide.addText(title, {
    x: 0.7,
    y: 0.45,
    w: width - 1.4,
    h: 0.65,
    fontFace: headingFont,
    fontSize: 25 * headingScale,
    bold: true,
    color: palette.foreground,
    margin: 0,
  })
  slide.addShape(pptx.ShapeType.line, {
    x: 0.7,
    y: 1.12,
    w: width - 1.4,
    h: 0,
    line: { color: palette.accentSoft, width: 2 },
  })
}

function addTextBlock(
  slide: ReturnType<PptxGenJS['addSlide']>,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: Palette,
  bodyFont: string,
  bodyScale: number,
  options: {
    bold?: boolean
    italic?: boolean
    bullet?: boolean | { type: 'number' }
    hyperlink?: { url?: string; slide?: number }
    color?: string
    fill?: string
    fontFace?: string
    fontSize?: number
  } = {},
) {
  slide.addText(text, {
    x,
    y,
    w,
    h,
    fontFace: options.fontFace || bodyFont,
    fontSize: (options.fontSize || 18) * bodyScale,
    bold: options.bold,
    italic: options.italic,
    bullet: options.bullet,
    hyperlink: options.hyperlink,
    color: options.color || palette.foreground,
    fill: options.fill ? { color: options.fill } : undefined,
    margin: options.fill ? 0.12 : 0,
    valign: 'middle',
    breakLine: false,
    fit: 'shrink',
  })
}

function addContent(
  pptx: PptxGenJS,
  slide: ReturnType<PptxGenJS['addSlide']>,
  source: Slide,
  palette: Palette,
  width: number,
  height: number,
  bodyFont: string,
  bodyScale: number,
  imageAssets: Record<string, string>,
  anchorSlides: Map<string, number>,
) {
  const document = new DOMParser().parseFromString(source.html, 'text/html')
  const root = document.body
  root.querySelector('h1, h2, h3, h4')?.remove()
  const elements = [...root.children]
  const top = source.kind === 'cover' ? 3.65 : source.kind === 'section' ? 4 : 1.35
  const bottom = 0.55
  const contentHeight = height - top - bottom
  const weights = elements.map((element) => {
    if (element.tagName === 'TABLE') return 3.2
    if (element.tagName === 'PRE') return 2.1
    if (element.querySelector('img')) return 3.4
    if (element.tagName === 'UL' || element.tagName === 'OL') {
      return Math.max(1.2, element.children.length * 0.72)
    }
    return Math.max(0.65, plainText(element).length / 55)
  })
  const totalWeight = Math.max(1, weights.reduce((sum, value) => sum + value, 0))
  let y = top

  elements.forEach((element, index) => {
    const allocated = Math.max(0.42, (weights[index] / totalWeight) * contentHeight)
    const tag = element.tagName
    const hyperlink = linkFor(element, anchorSlides)
    if (tag === 'UL' || tag === 'OL') {
      const items = [...element.querySelectorAll(':scope > li')]
      const itemHeight = allocated / Math.max(items.length, 1)
      items.forEach((item, itemIndex) => {
        addTextBlock(
          slide,
          plainText(item),
          0.95,
          y + itemIndex * itemHeight,
          width - 1.8,
          itemHeight,
          palette,
          bodyFont,
          bodyScale,
          {
            bullet: tag === 'OL' ? { type: 'number' } : true,
            hyperlink: linkFor(item, anchorSlides),
          },
        )
      })
    } else if (tag === 'TABLE') {
      const rows = [...element.querySelectorAll('tr')].map((row, rowIndex) =>
        [...row.children].map((cell) => ({
          text: plainText(cell),
          options: {
            bold: rowIndex === 0,
            color:
              rowIndex === 0 ? palette.background : palette.foreground,
            fill: {
              color:
                rowIndex === 0 ? palette.accent : palette.background,
            },
          },
        })),
      )
      slide.addTable(rows, {
        x: 0.8,
        y,
        w: width - 1.6,
        h: allocated,
        fontFace: bodyFont,
        fontSize: 13 * bodyScale,
        color: palette.foreground,
        border: { color: palette.accentSoft, pt: 1 },
        margin: 0.06,
      })
    } else if (tag === 'PRE') {
      addTextBlock(
        slide,
        element.textContent || '',
        0.8,
        y,
        width - 1.6,
        allocated,
        palette,
        bodyFont,
        bodyScale,
        {
          fill: palette.code,
          fontFace: 'Courier New',
          fontSize: 13,
        },
      )
    } else if (tag === 'BLOCKQUOTE') {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.8,
        y,
        w: 0.08,
        h: allocated,
        fill: { color: palette.accent },
        line: { color: palette.accent, transparency: 100 },
      })
      addTextBlock(
        slide,
        plainText(element),
        1.02,
        y,
        width - 1.9,
        allocated,
        palette,
        bodyFont,
        bodyScale,
        { italic: true, fill: palette.accentSoft },
      )
    } else if (element.querySelector('img')) {
      const image = element.querySelector('img')!
      const sourcePath = image.getAttribute('src') || ''
      const data = imageAssets[sourcePath]
      if (data) {
        slide.addImage({
          data,
          x: 1,
          y,
          w: width - 2,
          h: allocated,
        })
      } else {
        addTextBlock(
          slide,
          image.getAttribute('alt') || sourcePath,
          0.8,
          y,
          width - 1.6,
          allocated,
          palette,
          bodyFont,
          bodyScale,
          { italic: true, color: palette.muted },
        )
      }
    } else {
      addTextBlock(
        slide,
        plainText(element),
        0.8,
        y,
        width - 1.6,
        allocated,
        palette,
        bodyFont,
        bodyScale,
        {
          bold: tag === 'H4' || tag === 'STRONG',
          hyperlink,
          color: hyperlink ? palette.accent : palette.foreground,
        },
      )
    }
    y += allocated
  })
}

export function printSelectablePdf(
  html: string,
  title: string,
  opened: Window | null,
) {
  const printCss = `
    <style>
      @page { size: landscape; margin: 0; }
      @media print {
        html, body { width: 100%; height: 100%; }
        .reveal .controls, .reveal .progress, .reveal .slide-number,
        .web-overlay { display: none !important; }
        .reveal .fragment {
          opacity: 1 !important;
          visibility: visible !important;
          transform: none !important;
        }
      }
    </style>
  `
  const printable = html
    .replace('</head>', `${printCss}</head>`)
    .replace('Reveal.initialize({', "Reveal.initialize({ view: 'print',")
    .replace(
      '</body>',
      `<script>
        document.title = ${JSON.stringify(title || 'slides')};
        Reveal.on('ready', function () {
          setTimeout(function () { window.print(); }, 450);
        });
      </script></body>`,
    )
  const blob = new Blob([printable], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  if (!opened) {
    URL.revokeObjectURL(url)
    throw new Error('浏览器阻止了打印窗口，请允许弹出窗口。')
  }
  opened.location.href = url
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function exportEditablePptx(
  presentation: Presentation,
  ratio: SlideRatio,
  theme: ThemeName,
  imageAssets: Record<string, string>,
  settings: PresentationSettings,
) {
  const pptx = new PptxGenJS()
  const width = ratio === '4:3' ? 10 : 13.333
  const height = 7.5
  pptx.defineLayout({ name: 'DECKDOWN_EDITABLE', width, height })
  pptx.layout = 'DECKDOWN_EDITABLE'
  pptx.author = 'Deckdown'
  pptx.subject = presentation.title
  pptx.title = presentation.title
  pptx.company = 'Deckdown'

  const palette = palettes[theme]
  const headingFont = safeFont(settings.headingFont, 'Aptos Display')
  const bodyFont = safeFont(settings.bodyFont, 'Aptos')
  const anchorSlides = new Map(
    presentation.slides.map((slide, index) => [slide.anchor, index + 1]),
  )

  presentation.slides.forEach((source) => {
    const slide = pptx.addSlide()
    addDecorations(pptx, slide, source.kind, palette, width, height)
    if (source.title) {
      addTitle(
        pptx,
        slide,
        source.title,
        source.kind,
        palette,
        width,
        headingFont,
        settings.headingScale,
      )
    }
    addContent(
      pptx,
      slide,
      source,
      palette,
      width,
      height,
      bodyFont,
      settings.bodyScale,
      imageAssets,
      anchorSlides,
    )
  })

  await pptx.writeFile({
    fileName: `${presentation.title || 'slides'}.pptx`,
    compression: true,
  })
}

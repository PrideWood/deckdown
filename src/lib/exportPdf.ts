import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

interface RevealIndices {
  h: number
  v: number
}

interface RevealApi {
  getSlides: () => HTMLElement[]
  getIndices: (slide?: HTMLElement) => RevealIndices
  slide: (h: number, v?: number) => void
  sync: () => void
}

function waitForFrame(frame: HTMLIFrameElement) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('PDF 渲染页面加载超时。')),
      20_000,
    )
    frame.addEventListener(
      'load',
      () => {
        window.clearTimeout(timeout)
        resolve()
      },
      { once: true },
    )
  })
}

async function waitForPresentation(frame: HTMLIFrameElement) {
  const started = Date.now()
  while (Date.now() - started < 20_000) {
    const frameWindow = frame.contentWindow as
      | (Window & { Reveal?: RevealApi })
      | null
    const reveal = frameWindow?.Reveal
    if (reveal?.getSlides().length) {
      const document = frame.contentDocument
      await document?.fonts?.ready
      const images = [...(document?.images || [])]
      await Promise.all(
        images.map((image) => {
          if (image.complete) return Promise.resolve()
          return new Promise<void>((resolve) => {
            image.addEventListener('load', () => resolve(), { once: true })
            image.addEventListener('error', () => resolve(), { once: true })
          })
        }),
      )
      return reveal
    }
    await new Promise((resolve) => window.setTimeout(resolve, 80))
  }
  throw new Error('无法初始化 PDF 渲染页面。')
}

function nextPaint() {
  return new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

export async function exportImagePdf(
  html: string,
  title: string,
  ratio: '16:9' | '4:3',
  onProgress?: (current: number, total: number) => void,
) {
  const width = 1600
  const height = ratio === '4:3' ? 1200 : 900
  const frame = document.createElement('iframe')
  frame.title = 'PDF 导出渲染'
  frame.setAttribute('aria-hidden', 'true')
  Object.assign(frame.style, {
    position: 'fixed',
    left: '-20000px',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
    border: '0',
    opacity: '0',
    pointerEvents: 'none',
  })
  document.body.append(frame)

  try {
    const loaded = waitForFrame(frame)
    frame.srcdoc = html
    await loaded
    const reveal = await waitForPresentation(frame)
    const frameDocument = frame.contentDocument
    const viewport = frameDocument?.querySelector<HTMLElement>('.reveal')
    if (!frameDocument || !viewport) {
      throw new Error('找不到幻灯片渲染区域。')
    }

    frameDocument.documentElement.style.setProperty(
      '--deckdown-exporting-pdf',
      '1',
    )
    const exportStyle = frameDocument.createElement('style')
    if (exportStyle) {
      exportStyle.textContent = `
        .reveal .controls,
        .reveal .progress,
        .drawing-layer,
        .drawing-tools,
        .web-overlay {
          display: none !important;
        }
      `
      frameDocument.head.append(exportStyle)
    }
    frameDocument
      .querySelectorAll<HTMLElement>('.fragment')
      .forEach((fragment) => {
        fragment.style.opacity = '1'
        fragment.style.visibility = 'visible'
        fragment.style.transform = 'none'
      })

    const slides = reveal.getSlides()
    const orientation = 'landscape'
    const format = ratio === '4:3' ? [1200, 1600] : [900, 1600]
    const pdf = new jsPDF({
      orientation,
      unit: 'px',
      format,
      compress: true,
      hotfixes: ['px_scaling'],
    })

    for (let index = 0; index < slides.length; index += 1) {
      onProgress?.(index + 1, slides.length)
      const indices = reveal.getIndices(slides[index])
      reveal.slide(indices.h, indices.v)
      reveal.sync()
      await nextPaint()

      const canvas = await html2canvas(viewport, {
        backgroundColor: null,
        scale: 2.5,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        useCORS: true,
        allowTaint: false,
        logging: false,
      })
      const image = canvas.toDataURL('image/jpeg', 0.97)
      if (index > 0) pdf.addPage(format, orientation)
      pdf.addImage(image, 'JPEG', 0, 0, width, height, undefined, 'FAST')
    }

    pdf.save(`${title || 'slides'}.pdf`)
  } finally {
    frame.remove()
  }
}

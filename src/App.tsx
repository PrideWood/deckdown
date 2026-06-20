import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  FileText,
  FolderOpen,
  ImagePlus,
  Layout,
  Moon,
  PanelBottomClose,
  PanelBottomOpen,
  Play,
  RectangleHorizontal,
  RotateCcw,
  SquareArrowOutUpRight,
  Sun,
  Wand2,
} from 'lucide-react'
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from './components/MarkdownEditor'
import { buildPresentationHtml } from './lib/exportHtml'
import {
  compileMarkdown,
  formatYamlDate,
  formatMarkdownStructure,
  readBooleanSettingsFrontmatter,
  readDocumentDates,
  slideIndexAtOffset,
  syncBooleanSettingsFrontmatter,
  syncManagedToc,
} from './lib/markdown'
import {
  resolveLocalHtmlAssets,
  resolveLocalImageAssets,
  saveHtmlFilesToProject,
  saveImagesToProject,
} from './lib/projectFiles'
import defaultMarkdown from './content/default.md?raw'
import {
  defaultThemeCss,
  fontChoices,
  themeLabels,
  type ThemeName,
} from './lib/themes'
import type { ComponentStyles, PresentationSettings } from './lib/types'
import './App.css'

type InsertDialogState =
  | {
      type: 'web'
      url: string
      label: string
    }
  | {
      type: 'video'
      url: string
      title: string
      width: string
    }

const STORAGE_KEY = 'ready-slides:document'
const THEME_KEY = 'ready-slides:theme'
const SETTINGS_KEY = 'ready-slides:settings'
const APP_MODE_KEY = 'deckdown:app-mode'
const emptyComponentStyles: ComponentStyles = {
  list: '',
  code: '',
  quote: '',
  table: '',
  image: '',
}
const componentStyleTemplates: Record<keyof ComponentStyles, string> = {
  list: `.reveal ul,
.reveal ol {
  /* margin-left: 1em; */
}

.reveal li {
  /* line-height: 1.5; */
}

.reveal li::marker {
  /* color: var(--accent); */
}`,
  code: `.reveal pre {
  /* border-radius: 14px; */
  /* background: #272822; */
}

.reveal pre code {
  /* color: #f8f8f2; */
  /* font-size: .58em; */
}`,
  quote: `.reveal blockquote {
  /* width: 76%; */
  /* border-left: 8px solid var(--accent); */
  /* background: var(--accent-soft); */
}`,
  table: `.reveal table {
  /* font-size: .72em; */
}

.reveal table th,
.reveal table td {
  /* padding: .45em .6em; */
}`,
  image: `.reveal img {
  /* border-radius: 18px; */
  /* box-shadow: 0 22px 52px -14px rgba(0,0,0,.24); */
}`,
}
const componentStyleLabels: Record<keyof ComponentStyles, string> = {
  list: '列表',
  code: '代码框',
  quote: '引用',
  table: '表格',
  image: '图片',
}
const defaultSettings: PresentationSettings = {
  includeToc: true,
  verticalSubpages: true,
  progressiveReveal: true,
  imageShadow: true,
  navigationControls: true,
  enableDrawing: false,
  ratio: '16:9',
  headingFont: fontChoices[1].value,
  bodyFont: fontChoices[0].value,
  headingScale: 1,
  bodyScale: 1,
  componentStyles: emptyComponentStyles,
  themeCss: defaultThemeCss,
}

function settingsFromMarkdown(
  source: string,
  base: PresentationSettings,
): PresentationSettings {
  return {
    ...base,
    ...readBooleanSettingsFrontmatter(source),
  }
}

function syncMarkdownSettings(
  source: string,
  settings: PresentationSettings,
  dates = readDocumentDates(source),
) {
  return syncBooleanSettingsFrontmatter(
    syncManagedToc(source, settings.includeToc),
    settings,
    dates,
  )
}

function migrateSavedSettings(saved: Partial<PresentationSettings> & {
  chapterNavigation?: boolean
  hideNavigationControls?: boolean
}) {
  const {
    chapterNavigation,
    hideNavigationControls,
    ...currentSettings
  } = saved
  return {
    ...currentSettings,
    verticalSubpages:
      saved.verticalSubpages ?? chapterNavigation ?? true,
    navigationControls:
      saved.navigationControls ?? !(hideNavigationControls ?? false),
  }
}

function loadInitialState() {
  const source = localStorage.getItem(STORAGE_KEY) || defaultMarkdown
  try {
    const saved = migrateSavedSettings(
      JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'),
    )
    const settings = settingsFromMarkdown(source, {
      ...defaultSettings,
      ...saved,
      componentStyles: {
        ...emptyComponentStyles,
        ...(saved.componentStyles || {}),
      },
      themeCss: {
        ...loadThemeCss(saved.themeCss),
      },
    })
    return {
      settings,
      markdown: syncMarkdownSettings(source, settings),
    }
  } catch {
    return {
      settings: defaultSettings,
      markdown: syncMarkdownSettings(source, defaultSettings),
    }
  }
}

function loadThemeCss(saved?: Record<string, string>) {
  return Object.fromEntries(
    (Object.keys(defaultThemeCss) as ThemeName[]).map((name) => {
      const value = saved?.[name]
      const isLegacyTemplate =
        value?.includes('当前主题的全局幻灯片样式') &&
        !value.includes('--cover-pattern')
      const migrated = value
        ?.replace(/^\s*--decoration-display:[^;]+;\s*$/gm, '')
        .replace(/\.reveal\s+\.slide-cover::before\s*\{[^}]*\}/gs, '')
        .replace(/\.reveal\s+\.slide-section::before\s*\{[^}]*\}/gs, '')
      return [
        name,
        !migrated || isLegacyTemplate ? defaultThemeCss[name] : migrated,
      ]
    }),
  )
}

function RibbonMenu({
  id,
  icon,
  label,
  active,
  onToggle,
  children,
}: {
  id: string
  icon: ReactNode
  label: string
  active: boolean
  onToggle: (id: string) => void
  children: ReactNode
}) {
  return (
    <div
      className={`ribbon-menu ${active ? 'is-open' : ''}`}
      data-menu-id={id}
    >
      <button className="ribbon-button" onClick={() => onToggle(id)}>
        {icon}
        <span>{label}</span>
      </button>
      {active && <div className="ribbon-dropdown">{children}</div>}
    </div>
  )
}

function MenuItem({
  label,
  hint,
  onClick,
}: {
  label: string
  hint?: string
  onClick?: () => void
}) {
  return (
    <button className="menu-item" onClick={onClick}>
      <span>{label}</span>
      {hint && <span className="menu-hint">{hint}</span>}
    </button>
  )
}

function InsertDialog({
  value,
  error,
  onChange,
  onClose,
  onSubmit,
}: {
  value: InsertDialogState
  error: string
  onChange: (value: InsertDialogState) => void
  onClose: () => void
  onSubmit: () => void
}) {
  const isVideo = value.type === 'video'
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <form
        className="form-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={isVideo ? '插入在线视频' : '插入网页链接'}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <div className="dialog-header">
          <div>
            <strong>{isVideo ? '插入在线视频' : '插入网页链接'}</strong>
            <span>
              {isVideo
                ? '支持 YouTube、Bilibili 和标准 iframe 嵌入地址。'
                : '链接将插入到当前光标位置。'}
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className="dialog-fields">
          <label>
            <span>{isVideo ? '视频地址' : '网页地址'}</span>
            <input
              autoFocus
              type="url"
              inputMode="url"
              value={value.url}
              placeholder="https://"
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                onChange({ ...value, url: event.target.value })
              }
            />
          </label>
          {value.type === 'web' ? (
            <label>
              <span>链接名称</span>
              <input
                value={value.label}
                placeholder="打开网页"
                onChange={(event) =>
                  onChange({ ...value, label: event.target.value })
                }
              />
            </label>
          ) : (
            <>
              <label>
                <span>视频标题</span>
                <input
                  value={value.title}
                  placeholder="嵌入视频"
                  onChange={(event) =>
                    onChange({ ...value, title: event.target.value })
                  }
                />
              </label>
              <label>
                <span>显示宽度</span>
                <input
                  value={value.width}
                  placeholder="例如 800、80%（可留空）"
                  onChange={(event) =>
                    onChange({ ...value, width: event.target.value })
                  }
                />
                <small>纯数字按像素处理，也支持百分比和 CSS 长度。</small>
              </label>
            </>
          )}
          {error && <div className="dialog-error">{error}</div>}
        </div>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary" type="submit">
            插入
          </button>
        </div>
      </form>
    </div>
  )
}

function GitHubMark() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.64 5.47 7.72.4.08.55-.18.55-.39 0-.19-.01-.83-.01-1.5-2.01.38-2.53-.5-2.69-.96-.09-.23-.48-.96-.82-1.15-.28-.15-.68-.53-.01-.54.63-.01 1.08.59 1.23.83.72 1.23 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.78-.21-3.64-.91-3.64-4.01 0-.89.31-1.62.82-2.19-.08-.2-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.46 7.46 0 0 1 8 3.94c.68 0 1.36.09 2 .28 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.96.08 2.16.51.57.82 1.3.82 2.19 0 3.11-1.87 3.8-3.65 4.01.29.25.54.74.54 1.5 0 1.08-.01 1.95-.01 2.22 0 .22.15.47.55.39A8.15 8.15 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z" />
    </svg>
  )
}

function App() {
  const initialState = useMemo(() => loadInitialState(), [])
  const [markdown, setMarkdown] = useState(initialState.markdown)
  const [theme, setTheme] = useState<ThemeName>(
    () => (localStorage.getItem(THEME_KEY) as ThemeName) || 'paper',
  )
  const [settings, setSettings] =
    useState<PresentationSettings>(initialState.settings)
  const [openMenu, setOpenMenu] = useState('')
  const [fontDialogOpen, setFontDialogOpen] = useState(false)
  const [styleDialogOpen, setStyleDialogOpen] = useState(false)
  const [insertDialog, setInsertDialog] =
    useState<InsertDialogState | null>(null)
  const [insertDialogError, setInsertDialogError] = useState('')
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [appDarkMode, setAppDarkMode] = useState(
    () => localStorage.getItem(APP_MODE_KEY) === 'dark',
  )
  const [activeStyleComponent, setActiveStyleComponent] =
    useState<keyof ComponentStyles | 'global'>('global')
  const fileInput = useRef<HTMLInputElement>(null)
  const projectHtmlInput = useRef<HTMLInputElement>(null)
  const zipInput = useRef<HTMLInputElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const htmlInput = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLIFrameElement>(null)
  const activeSlideIndexRef = useRef(0)
  const pendingModifiedRef = useRef(false)
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const [notice, setNotice] = useState('')
  const [cursorOffset, setCursorOffset] = useState(0)
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false)
  const [imageAssets, setImageAssets] = useState<Record<string, string>>({})
  const [htmlAssets, setHtmlAssets] = useState<Record<string, string>>({})
  const [exporting, setExporting] = useState('')

  const presentation = useMemo(
    () => compileMarkdown(markdown, settings.includeToc),
    [markdown, settings.includeToc],
  )
  const activeSlideIndex = useMemo(
    () => slideIndexAtOffset(presentation, cursorOffset),
    [presentation, cursorOffset],
  )
  const previewHtml = useMemo(
    () =>
      buildPresentationHtml(
        presentation,
        theme,
        true,
        imageAssets,
        settings,
        htmlAssets,
      ),
    [presentation, theme, imageAssets, settings, htmlAssets],
  )

  useEffect(() => {
    let cancelled = false
    void resolveLocalImageAssets(markdown)
      .then((assets) => {
        if (!cancelled) setImageAssets(assets)
      })
      .catch(() => {
        if (!cancelled) setImageAssets({})
      })
    return () => {
      cancelled = true
    }
  }, [markdown])

  useEffect(() => {
    let cancelled = false
    void resolveLocalHtmlAssets(markdown)
      .then((assets) => {
        if (!cancelled) setHtmlAssets(assets)
      })
      .catch(() => {
        if (!cancelled) setHtmlAssets({})
      })
    return () => {
      cancelled = true
    }
  }, [markdown])

  useEffect(() => {
    activeSlideIndexRef.current = activeSlideIndex
    const timers = [0, 100, 320].map((delay) =>
      window.setTimeout(() => {
        previewRef.current?.contentWindow?.postMessage(
          { type: 'ready-slides:go-to', index: activeSlideIndex },
          '*',
        )
      }, delay),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [activeSlideIndex, previewHtml])

  useEffect(() => {
    const handlePreviewReady = (event: MessageEvent) => {
      if (
        event.source !== previewRef.current?.contentWindow ||
        event.data?.type !== 'ready-slides:ready'
      ) {
        return
      }
      previewRef.current?.contentWindow?.postMessage(
        {
          type: 'ready-slides:go-to',
          index: activeSlideIndexRef.current,
        },
        '*',
      )
    }
    window.addEventListener('message', handlePreviewReady)
    return () => window.removeEventListener('message', handlePreviewReady)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, markdown)
      } catch {
        setNotice(
          '本地图片较大，浏览器无法继续自动保存；HTML 导出仍然正常。',
        )
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [markdown])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const dates = readDocumentDates(markdown)
      const synced = syncMarkdownSettings(markdown, settings, {
        created: dates.created,
        modified: pendingModifiedRef.current
          ? formatYamlDate()
          : dates.modified,
      })
      pendingModifiedRef.current = false
      if (synced !== markdown) setMarkdown(synced)
    }, 450)
    return () => window.clearTimeout(timer)
  }, [markdown, settings])

  useEffect(() => {
    localStorage.setItem(APP_MODE_KEY, appDarkMode ? 'dark' : 'light')
  }, [appDarkMode])

  useEffect(() => {
    const landscape = window.matchMedia('(orientation: landscape)')
    const collapseEditor = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileEditorOpen(false)
    }
    landscape.addEventListener('change', collapseEditor)
    return () => landscape.removeEventListener('change', collapseEditor)
  }, [])

  useEffect(() => {
    const close = () => setOpenMenu('')
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const toggleMenu = (id: string) => {
    setOpenMenu((current) => (current === id ? '' : id))
  }

  const downloadHtml = () => {
    const html = buildPresentationHtml(
      presentation,
      theme,
      false,
      imageAssets,
      settings,
      htmlAssets,
      {
        format: 'deckdown-html-project',
        version: 1,
        markdown,
        theme,
        settings,
        imageAssets,
        htmlAssets,
      },
    )
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${presentation.title || 'slides'}.html`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const downloadPdf = async () => {
    setOpenMenu('')
    setExporting('pdf')
    setNotice('正在生成高清图片 PDF…')
    try {
      const html = buildPresentationHtml(
        presentation,
        theme,
        true,
        imageAssets,
        settings,
        htmlAssets,
      )
      const { exportImagePdf } = await import('./lib/exportPdf')
      await exportImagePdf(
        html,
        presentation.title,
        settings.ratio,
        (current, total) =>
          setNotice(`正在生成高清图片 PDF（${current}/${total}）…`),
      )
      setNotice('高清图片 PDF 已导出。')
    } catch (error) {
      console.error(error)
      setNotice('PDF 导出失败，请稍后重试。')
    } finally {
      setExporting('')
      window.setTimeout(() => setNotice(''), 3200)
    }
  }

  const downloadProjectZip = async () => {
    setOpenMenu('')
    setExporting('zip')
    setNotice('正在打包项目文件…')
    try {
      const { exportProjectZip } = await import('./lib/projectZip')
      await exportProjectZip({
        markdown,
        title: presentation.title,
        theme,
        settings,
        imageAssets,
        htmlAssets,
      })
      setNotice('项目 ZIP 已导出，包含 Markdown、HTML、素材和编辑设置。')
    } catch (error) {
      console.error(error)
      setNotice('项目 ZIP 导出失败，请稍后重试。')
    } finally {
      setExporting('')
      window.setTimeout(() => setNotice(''), 3200)
    }
  }

  const openPresentation = () => {
    const html = buildPresentationHtml(
      presentation,
      theme,
      false,
      imageAssets,
      settings,
      htmlAssets,
    )
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer')
  }

  const openMobilePresentation = () => {
    const html = buildPresentationHtml(
      presentation,
      theme,
      false,
      imageAssets,
      settings,
      htmlAssets,
    ).replace(
      '</body>',
      `<script>
        (function () {
          async function requestLandscape() {
            try {
              if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
              }
            } catch (error) {}
            try {
              if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape');
              }
            } catch (error) {}
          }
          requestLandscape();
          window.addEventListener('pointerdown', requestLandscape, { once: true });
        })();
      </script></body>`,
    )
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const opened = window.open(url, '_blank')
    if (!opened) {
      URL.revokeObjectURL(url)
      setNotice('浏览器阻止了播放页面，请允许打开新窗口后重试。')
      window.setTimeout(() => setNotice(''), 3200)
      return
    }
    opened.opener = null
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const importMarkdown = async (file?: File) => {
    if (!file) return
    const source = await file.text()
    const importedSettings = settingsFromMarkdown(source, settings)
    const importedAt = formatYamlDate()
    setSettings(importedSettings)
    setMarkdown(
      syncMarkdownSettings(source, importedSettings, {
        created: importedAt,
        modified: importedAt,
      }),
    )
  }

  const restoreImportedProject = (imported: {
    markdown: string
    theme?: ThemeName
    settings?: PresentationSettings
    assetCount: number
  }) => {
    const baseImportedSettings = imported.settings
      ? {
          ...defaultSettings,
          ...migrateSavedSettings(imported.settings),
          componentStyles: {
            ...emptyComponentStyles,
            ...(imported.settings.componentStyles || {}),
          },
          themeCss: loadThemeCss(imported.settings.themeCss),
        }
      : settings
    const importedSettings = settingsFromMarkdown(
      imported.markdown,
      baseImportedSettings,
    )
    setSettings(importedSettings)
    if (imported.theme && imported.theme in themeLabels) {
      setTheme(imported.theme)
    }
    const importedAt = formatYamlDate()
    setMarkdown(
      syncMarkdownSettings(imported.markdown, importedSettings, {
        created: importedAt,
        modified: importedAt,
      }),
    )
  }

  const importHtmlProject = async (file?: File) => {
    if (!file) return
    setOpenMenu('')
    setNotice('正在读取 HTML 项目…')
    try {
      const { importDeckdownHtml } = await import('./lib/importHtml')
      const imported = await importDeckdownHtml(file)
      restoreImportedProject(imported)
      setNotice(`HTML 项目已恢复，共载入 ${imported.assetCount} 个素材文件。`)
    } catch (error) {
      console.error(error)
      setNotice((error as Error).message || 'HTML 项目导入失败。')
    }
    window.setTimeout(() => setNotice(''), 3600)
  }

  const importProject = async (file?: File) => {
    if (!file) return
    setOpenMenu('')
    setNotice('正在读取项目 ZIP…')
    try {
      const { importProjectZip } = await import('./lib/projectZip')
      const imported = await importProjectZip(file)
      restoreImportedProject(imported)
      setNotice(`项目已恢复，共载入 ${imported.assetCount} 个素材文件。`)
    } catch (error) {
      console.error(error)
      setNotice((error as Error).message || '项目 ZIP 导入失败。')
    }
    window.setTimeout(() => setNotice(''), 3200)
  }

  const insertImageFiles = async (files: File[]) => {
    setNotice('正在处理本地图片…')
    try {
      const imageMarkdown = await saveImagesToProject(files)
      setNotice(
        imageMarkdown
          ? `已将 ${files.length} 张图片保存到浏览器素材库，Markdown 使用 images/ 相对路径。`
          : '没有找到可用的图片。',
      )
      window.setTimeout(() => setNotice(''), 2600)
      return imageMarkdown
    } catch {
      setNotice('图片处理失败，请换一张图片重试。')
      return ''
    }
  }

  const chooseImages = async (files?: FileList | null) => {
    if (!files?.length) return
    const text = await insertImageFiles(Array.from(files))
    editorRef.current?.insertText(text)
  }

  const resetDocument = () => {
    const createdAt = formatYamlDate()
    setMarkdown(
      syncMarkdownSettings(defaultMarkdown, settings, {
        created: createdAt,
        modified: createdAt,
      }),
    )
    setResetDialogOpen(false)
  }

  const formatDocument = () => {
    pendingModifiedRef.current = true
    setMarkdown((value) =>
      syncMarkdownSettings(
        formatMarkdownStructure(value),
        settings,
      ),
    )
    setNotice('已整理标题层级：H1 标题页、H2 章节页、H3 内容页。')
    window.setTimeout(() => setNotice(''), 2600)
  }

  const insertWebPage = () => {
    setInsertDialogError('')
    setInsertDialog({
      type: 'web',
      url: 'https://',
      label: '打开网页',
    })
  }

  const insertVideo = () => {
    setInsertDialogError('')
    setInsertDialog({
      type: 'video',
      url: 'https://',
      title: '嵌入视频',
      width: '',
    })
  }

  const submitInsertDialog = () => {
    if (!insertDialog) return
    let url: URL
    try {
      url = new URL(insertDialog.url)
    } catch {
      setInsertDialogError('地址格式不正确，请输入完整的 http:// 或 https:// 地址。')
      return
    }
    if (!/^https?:$/.test(url.protocol)) {
      setInsertDialogError('目前仅支持 http:// 和 https:// 地址。')
      return
    }

    if (insertDialog.type === 'web') {
      const label = insertDialog.label.trim() || '打开网页'
      editorRef.current?.insertText(`\n\n[${label}](${url.toString()})\n\n`)
      setInsertDialog(null)
      return
    }

    let embedUrl = url.toString()
    const hostname = url.hostname.replace(/^www\./, '')
    if (hostname === 'youtu.be') {
      const videoId = url.pathname.split('/').filter(Boolean)[0]
      if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`
    } else if (hostname.endsWith('youtube.com')) {
      const videoId =
        url.searchParams.get('v') ||
        url.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/)?.[1]
      if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`
    } else if (hostname.endsWith('bilibili.com')) {
      const videoId = url.pathname.match(/\/video\/(BV[\w]+|av\d+)/i)?.[1]
      if (videoId?.toLowerCase().startsWith('av')) {
        embedUrl = `https://player.bilibili.com/player.html?aid=${videoId.slice(2)}`
      } else if (videoId) {
        embedUrl = `https://player.bilibili.com/player.html?bvid=${videoId}`
      }
      const page = url.searchParams.get('p')
      if (page && embedUrl.includes('player.bilibili.com')) {
        embedUrl += `&page=${encodeURIComponent(page)}`
      }
    }

    const width = insertDialog.width.trim()
    if (
      width &&
      !/^(?:\d+(?:\.\d+)?(?:px|%|rem|em|vw)?|auto)$/i.test(width)
    ) {
      setInsertDialogError('宽度请填写数字、百分比或 px / rem / em / vw。')
      return
    }
    const title = insertDialog.title.trim() || '嵌入视频'
    const widthAttribute = width
      ? ` width="${width.replace(/"/g, '&quot;')}"`
      : ''
    editorRef.current?.insertText(
      `\n\n<iframe src="${embedUrl}" title="${title.replace(/"/g, '&quot;')}"${widthAttribute} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>\n\n`,
    )
    setInsertDialog(null)
  }

  const chooseHtmlFiles = async (files?: FileList | null) => {
    if (!files?.length) return
    setNotice('正在处理 HTML 文件…')
    try {
      const result = await saveHtmlFilesToProject(Array.from(files))
      setHtmlAssets((current) => ({ ...current, ...result.assets }))
      editorRef.current?.insertText(result.markdown)
      setNotice(`已将 ${files.length} 个 HTML 文件嵌入浏览器素材库。`)
    } catch {
      setNotice('HTML 文件处理失败，请重试。')
    }
    window.setTimeout(() => setNotice(''), 2600)
  }

  const updateSettings = (patch: Partial<PresentationSettings>) => {
    pendingModifiedRef.current = true
    setSettings((current) => ({ ...current, ...patch }))
  }

  const updateMarkdown = (value: string) => {
    const frontmatterSettings = readBooleanSettingsFrontmatter(value)
    pendingModifiedRef.current = true
    if (Object.keys(frontmatterSettings).length) {
      setSettings((current) => ({
        ...current,
        ...frontmatterSettings,
      }))
    }
    setMarkdown(value)
  }

  const updateComponentStyle = (
    component: keyof ComponentStyles,
    value: string,
  ) => {
    pendingModifiedRef.current = true
    setSettings((current) => ({
      ...current,
      componentStyles: {
        ...current.componentStyles,
        [component]: value,
      },
    }))
  }

  const updateThemeCss = (value: string) => {
    pendingModifiedRef.current = true
    setSettings((current) => ({
      ...current,
      themeCss: {
        ...current.themeCss,
        [theme]: value,
      },
    }))
  }

  return (
    <main className={`app-shell ${appDarkMode ? 'is-dark' : ''}`}>
      {openMenu && (
        <button
          className="mobile-menu-backdrop"
          type="button"
          aria-label="关闭菜单"
          onClick={() => setOpenMenu('')}
        />
      )}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <img
              src={`${import.meta.env.BASE_URL}android-chrome-192x192.png`}
              alt=""
            />
          </div>
          <div>
            <strong>Deckdown</strong>
            <span>MARKDOWN → DECK</span>
          </div>
        </div>

        <div className="ribbon" onClick={(event) => event.stopPropagation()}>
          <RibbonMenu
            id="open"
            icon={<FolderOpen size={18} />}
            label="导入"
            active={openMenu === 'open'}
            onToggle={toggleMenu}
          >
            <MenuItem
              label="导入 Markdown"
              hint=".md"
              onClick={() => fileInput.current?.click()}
            />
            <MenuItem
              label="导入 HTML"
              hint=".html"
              onClick={() => projectHtmlInput.current?.click()}
            />
            <MenuItem
              label="导入 Deckdown 项目"
              hint=".zip"
              onClick={() => zipInput.current?.click()}
            />
          </RibbonMenu>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            onChange={(event) => importMarkdown(event.target.files?.[0])}
          />
          <input
            ref={projectHtmlInput}
            hidden
            type="file"
            accept=".html,.htm,text/html"
            onChange={(event) => {
              void importHtmlProject(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <input
            ref={zipInput}
            hidden
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => {
              void importProject(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          <RibbonMenu
            id="format"
            icon={<Wand2 size={18} />}
            label="格式化"
            active={openMenu === 'format'}
            onToggle={toggleMenu}
          >
            <MenuItem
              label="快速整理标题"
              hint="H1 / H2 / H3"
              onClick={formatDocument}
            />
          </RibbonMenu>

          <RibbonMenu
            id="insert"
            icon={<ImagePlus size={18} />}
            label="插入"
            active={openMenu === 'insert'}
            onToggle={toggleMenu}
          >
            <MenuItem
              label="插入图片"
              onClick={() => imageInput.current?.click()}
            />
            <MenuItem
              label="插入 HTML 文件"
              hint="嵌入演示"
              onClick={() => htmlInput.current?.click()}
            />
            <MenuItem
              label="插入网页地址"
              hint="https://"
              onClick={insertWebPage}
            />
            <MenuItem
              label="插入视频"
              hint="YouTube / Bilibili"
              onClick={insertVideo}
            />
          </RibbonMenu>
          <input
            ref={imageInput}
            hidden
            multiple
            type="file"
            accept="image/*"
            onChange={(event) => {
              void chooseImages(event.target.files)
              event.target.value = ''
            }}
          />
          <input
            ref={htmlInput}
            hidden
            multiple
            type="file"
            accept=".html,.htm,text/html"
            onChange={(event) => {
              void chooseHtmlFiles(event.target.files)
              event.target.value = ''
            }}
          />

          <RibbonMenu
            id="design"
            icon={<Layout size={18} />}
            label="设计"
            active={openMenu === 'design'}
            onToggle={toggleMenu}
          >
            <div className="menu-label">主题</div>
            <div className="theme-grid">
              {(Object.keys(themeLabels) as ThemeName[]).map((name) => (
                <button
                  key={name}
                  className={`theme-swatch theme-${name} ${theme === name ? 'is-active' : ''}`}
                  onClick={() => {
                    pendingModifiedRef.current = true
                    setTheme(name)
                    const dates = readDocumentDates(markdown)
                    setMarkdown(
                      syncMarkdownSettings(markdown, settings, {
                        created: dates.created,
                        modified: formatYamlDate(),
                      }),
                    )
                    pendingModifiedRef.current = false
                  }}
                >
                  <span />
                  {themeLabels[name]}
                </button>
              ))}
            </div>
            <div className="menu-separator" />
            <MenuItem
              label="字体设置"
              hint="标题 / 正文"
              onClick={() => setFontDialogOpen(true)}
            />
            <MenuItem
              label="组件 CSS"
              hint="列表 / 代码 / 引用…"
              onClick={() => setStyleDialogOpen(true)}
            />
            <div className="submenu-row">
              <span>幻灯片大小</span>
              <div className="segmented">
                {(['16:9', '4:3'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    className={settings.ratio === ratio ? 'is-active' : ''}
                    onClick={() => updateSettings({ ratio })}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
            <div className="submenu-row">
              <span>纵向子页面</span>
              <button
                className={`toggle-switch ${settings.verticalSubpages ? 'is-active' : ''}`}
                role="switch"
                aria-checked={settings.verticalSubpages}
                onClick={() =>
                  updateSettings({
                    verticalSubpages: !settings.verticalSubpages,
                  })
                }
              >
                <span />
              </button>
            </div>
            <div className="submenu-row">
              <span>自动目录</span>
              <button
                className={`toggle-switch ${settings.includeToc ? 'is-active' : ''}`}
                role="switch"
                aria-checked={settings.includeToc}
                onClick={() =>
                  updateSettings({
                    includeToc: !settings.includeToc,
                  })
                }
              >
                <span />
              </button>
            </div>
            <div className="submenu-row">
              <span>列表逐项出现动画</span>
              <button
                className={`toggle-switch ${settings.progressiveReveal ? 'is-active' : ''}`}
                role="switch"
                aria-checked={settings.progressiveReveal}
                onClick={() =>
                  updateSettings({
                    progressiveReveal: !settings.progressiveReveal,
                  })
                }
              >
                <span />
              </button>
            </div>
            <div className="submenu-row">
              <span>图片阴影</span>
              <button
                className={`toggle-switch ${settings.imageShadow ? 'is-active' : ''}`}
                role="switch"
                aria-checked={settings.imageShadow}
                onClick={() =>
                  updateSettings({
                    imageShadow: !settings.imageShadow,
                  })
                }
              >
                <span />
              </button>
            </div>
            <div className="submenu-row">
              <span>导航控件</span>
              <button
                className={`toggle-switch ${settings.navigationControls ? 'is-active' : ''}`}
                role="switch"
                aria-checked={settings.navigationControls}
                onClick={() =>
                  updateSettings({
                    navigationControls: !settings.navigationControls,
                  })
                }
              >
                <span />
              </button>
            </div>
            <div className="submenu-row">
              <span>自由绘图</span>
              <button
                className={`toggle-switch ${settings.enableDrawing ? 'is-active' : ''}`}
                role="switch"
                aria-checked={settings.enableDrawing}
                onClick={() =>
                  updateSettings({
                    enableDrawing: !settings.enableDrawing,
                  })
                }
              >
                <span />
              </button>
            </div>
          </RibbonMenu>

          <button className="ribbon-button" onClick={openPresentation}>
            <Play size={18} />
            <span>播放</span>
          </button>
          <RibbonMenu
            id="export"
            icon={<SquareArrowOutUpRight size={18} />}
            label="导出"
            active={openMenu === 'export'}
            onToggle={toggleMenu}
          >
            <MenuItem
              label="导出独立 HTML"
              hint="离线播放"
              onClick={downloadHtml}
            />
            <MenuItem
              label={exporting === 'pdf' ? '正在生成 PDF…' : '导出 PDF'}
              hint="高清图片"
              onClick={() => void downloadPdf()}
            />
            <MenuItem
              label={exporting === 'zip' ? '正在打包项目…' : '导出项目 ZIP'}
              hint="跨设备继续编辑"
              onClick={() => void downloadProjectZip()}
            />
          </RibbonMenu>
          <button
            className="ribbon-button"
            onClick={() => setResetDialogOpen(true)}
            title="恢复示例"
          >
            <RotateCcw size={16} />
            <span>恢复</span>
          </button>
        </div>
        <div className="topbar-actions">
          <button
            className="topbar-action"
            onClick={() => setAppDarkMode((current) => !current)}
            title={appDarkMode ? '切换到日间模式' : '切换到夜间模式'}
          >
            {appDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a
            className="topbar-action"
            href="https://github.com/PrideWood/deckdown"
            target="_blank"
            rel="noreferrer"
            title="GitHub"
            aria-label="GitHub"
          >
            <GitHubMark />
          </a>
        </div>
      </header>

      <section className="workspace">
        <div
          className={`pane editor-pane ${mobileEditorOpen ? 'is-mobile-expanded' : ''}`}
        >
          <div className="pane-header">
            <div>
              <FileText size={16} />
              <span>Markdown</span>
            </div>
            <span className="status">
              可编辑 · 自动保存 · {markdown.length.toLocaleString()} 字符
            </span>
            <button
              className="mobile-editor-toggle"
              type="button"
              onClick={() => setMobileEditorOpen((current) => !current)}
              aria-expanded={mobileEditorOpen}
            >
              {mobileEditorOpen ? (
                <PanelBottomClose size={16} />
              ) : (
                <PanelBottomOpen size={16} />
              )}
              <span>{mobileEditorOpen ? '收起编辑' : '展开编辑'}</span>
            </button>
          </div>
          <MarkdownEditor
            ref={editorRef}
            value={markdown}
            onChange={updateMarkdown}
            onImageFiles={insertImageFiles}
            onCursorChange={setCursorOffset}
          />
          <div className="editor-tip">
            点击后直接输入 · 可粘贴或拖入本地图片
          </div>
        </div>

        <div className="divider" />

        <div className="pane preview-pane">
          <div className="pane-header preview-header">
            <span className="status">
              第 {activeSlideIndex + 1} / {presentation.slides.length} 页
            </span>
          </div>
          <div className="preview-stage">
            <iframe
              ref={previewRef}
              title="幻灯片预览"
              srcDoc={previewHtml}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-presentation"
              onLoad={() => {
                previewRef.current?.contentWindow?.postMessage(
                  {
                    type: 'ready-slides:go-to',
                    index: activeSlideIndexRef.current,
                  },
                  '*',
                )
              }}
            />
            <button
              className="mobile-landscape-button"
              type="button"
              onClick={openMobilePresentation}
              title="在独立页面横屏播放"
            >
              <RectangleHorizontal size={19} />
              <span>横屏播放</span>
            </button>
          </div>
          <div className="preview-tip">
            <span>
              {settings.verticalSubpages
                ? '← → 切换章节 · ↑ ↓ 切换章节内容'
                : '方向键线性切换幻灯片'}{' '}
              · F 全屏 · O 总览
            </span>
          </div>
        </div>
      </section>
      {insertDialog && (
        <InsertDialog
          value={insertDialog}
          error={insertDialogError}
          onChange={(value) => {
            setInsertDialog(value)
            setInsertDialogError('')
          }}
          onClose={() => {
            setInsertDialog(null)
            setInsertDialogError('')
          }}
          onSubmit={submitInsertDialog}
        />
      )}
      {resetDialogOpen && (
        <div
          className="dialog-backdrop"
          onMouseDown={() => setResetDialogOpen(false)}
        >
          <section
            className="form-dialog confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="恢复示例内容"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dialog-header">
              <div>
                <strong>恢复示例内容</strong>
                <span>当前编辑内容将被示例文稿替换，此操作无法撤销。</span>
              </div>
              <button
                type="button"
                onClick={() => setResetDialogOpen(false)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="dialog-actions">
              <button type="button" onClick={() => setResetDialogOpen(false)}>
                取消
              </button>
              <button className="primary danger" type="button" onClick={resetDocument}>
                恢复示例
              </button>
            </div>
          </section>
        </div>
      )}
      {fontDialogOpen && (
        <div className="dialog-backdrop" onMouseDown={() => setFontDialogOpen(false)}>
          <section className="font-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <div className="dialog-header">
              <div>
                <strong>字体设置</strong>
                <span>分别控制标题与正文，预览会立即更新。</span>
              </div>
              <button onClick={() => setFontDialogOpen(false)}>×</button>
            </div>
            <label>
              标题字体
              <select
                value={settings.headingFont}
                onChange={(event) => updateSettings({ headingFont: event.target.value })}
              >
                {fontChoices.map((font) => (
                  <option key={font.label} value={font.value}>{font.label}</option>
                ))}
              </select>
            </label>
            <label>
              正文字体
              <select
                value={settings.bodyFont}
                onChange={(event) => updateSettings({ bodyFont: event.target.value })}
              >
                {fontChoices.map((font) => (
                  <option key={font.label} value={font.value}>{font.label}</option>
                ))}
              </select>
            </label>
            <label>
              标题字号 <output>{Math.round(settings.headingScale * 100)}%</output>
              <input
                type="range"
                min=".8"
                max="1.35"
                step=".05"
                value={settings.headingScale}
                onChange={(event) => updateSettings({ headingScale: Number(event.target.value) })}
              />
            </label>
            <label>
              正文字号 <output>{Math.round(settings.bodyScale * 100)}%</output>
              <input
                type="range"
                min=".8"
                max="1.25"
                step=".05"
                value={settings.bodyScale}
                onChange={(event) => updateSettings({ bodyScale: Number(event.target.value) })}
              />
            </label>
            <div className="dialog-actions">
              <button
                onClick={() =>
                  updateSettings({
                    headingFont: defaultSettings.headingFont,
                    bodyFont: defaultSettings.bodyFont,
                    headingScale: 1,
                    bodyScale: 1,
                  })
                }
              >
                恢复默认
              </button>
              <button className="primary" onClick={() => setFontDialogOpen(false)}>完成</button>
            </div>
          </section>
        </div>
      )}
      {styleDialogOpen && (
        <div className="dialog-backdrop" onMouseDown={() => setStyleDialogOpen(false)}>
          <section
            className="style-dialog"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="dialog-header">
              <div>
                <strong>组件 CSS</strong>
                <span>全局 CSS 中可直接修改封面背景、渐变图案和章节装饰。</span>
              </div>
              <button onClick={() => setStyleDialogOpen(false)}>×</button>
            </div>
            <div className="style-editor-layout">
              <nav className="style-component-tabs">
                <button
                  className={activeStyleComponent === 'global' ? 'is-active' : ''}
                  onClick={() => setActiveStyleComponent('global')}
                >
                  全局幻灯片
                </button>
                {(Object.keys(componentStyleLabels) as Array<keyof ComponentStyles>).map(
                  (component) => (
                    <button
                      key={component}
                      className={activeStyleComponent === component ? 'is-active' : ''}
                      onClick={() => setActiveStyleComponent(component)}
                    >
                      {componentStyleLabels[component]}
                    </button>
                  ),
                )}
              </nav>
              <div className="style-code-pane">
                <div className="style-code-toolbar">
                  <span>
                    {activeStyleComponent === 'global'
                      ? `${themeLabels[theme]}主题 · 全局 CSS`
                      : `${componentStyleLabels[activeStyleComponent]} CSS`}
                  </span>
                  <button
                    onClick={() => {
                      if (activeStyleComponent === 'global') {
                        updateThemeCss(defaultThemeCss[theme])
                      } else {
                        updateComponentStyle(
                          activeStyleComponent,
                          componentStyleTemplates[activeStyleComponent],
                        )
                      }
                    }}
                  >
                    {activeStyleComponent === 'global' ? '恢复当前主题 CSS' : '插入代码框架'}
                  </button>
                </div>
                <textarea
                  spellCheck={false}
                  value={
                    activeStyleComponent === 'global'
                      ? settings.themeCss[theme]
                      : settings.componentStyles[activeStyleComponent]
                  }
                  placeholder={
                    activeStyleComponent === 'global'
                      ? defaultThemeCss[theme]
                      : componentStyleTemplates[activeStyleComponent]
                  }
                  onChange={(event) => {
                    if (activeStyleComponent === 'global') {
                      updateThemeCss(event.target.value)
                    } else {
                      updateComponentStyle(activeStyleComponent, event.target.value)
                    }
                  }}
                />
              </div>
            </div>
            <div className="dialog-actions">
              <button
                onClick={() => {
                  updateSettings({
                    componentStyles: emptyComponentStyles,
                    themeCss: defaultThemeCss,
                  })
                }}
              >
                清空全部
              </button>
              <button className="primary" onClick={() => setStyleDialogOpen(false)}>
                完成
              </button>
            </div>
          </section>
        </div>
      )}
      {notice && <div className="toast">{notice}</div>}
    </main>
  )
}

export default App

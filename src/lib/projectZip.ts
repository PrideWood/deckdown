import JSZip from 'jszip'
import { buildPresentationHtml } from './exportHtml'
import { compileMarkdown } from './markdown'
import { storeBrowserAsset } from './projectFiles'
import type { PresentationSettings } from './types'
import type { ThemeName } from './themes'

interface ProjectManifest {
  format: 'deckdown-project'
  version: 1
  title: string
  theme: ThemeName
  settings: PresentationSettings
  markdownFile: string
  htmlFile: string
  createdAt: string
}

function downloadBlob(blob: Blob, fileName: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

function dataUrlToBlob(dataUrl: string) {
  const [metadata, encoded = ''] = dataUrl.split(',', 2)
  const mime = metadata.match(/^data:([^;,]+)/)?.[1] || 'application/octet-stream'
  if (metadata.includes(';base64')) {
    const bytes = Uint8Array.from(atob(encoded), (character) =>
      character.charCodeAt(0),
    )
    return new Blob([bytes], { type: mime })
  }
  return new Blob([decodeURIComponent(encoded)], { type: mime })
}

function mimeTypeForPath(path: string) {
  const extension = path.split('.').pop()?.toLowerCase()
  return (
    {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      html: 'text/html',
      htm: 'text/html',
      css: 'text/css',
      js: 'text/javascript',
      json: 'application/json',
    }[extension || ''] || 'application/octet-stream'
  )
}

function safeAssetName(path: string, used: Set<string>) {
  const decoded = (() => {
    try {
      return decodeURIComponent(path)
    } catch {
      return path
    }
  })()
  const base =
    decoded
      .split(/[\\/]/)
      .at(-1)
      ?.replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'asset'
  let candidate = `assets/${base}`
  let index = 2
  while (used.has(candidate)) {
    const dot = base.lastIndexOf('.')
    candidate =
      dot > 0
        ? `assets/${base.slice(0, dot)}-${index}${base.slice(dot)}`
        : `assets/${base}-${index}`
    index += 1
  }
  used.add(candidate)
  return candidate
}

function rewriteMarkdownAssets(
  markdown: string,
  replacements: Map<string, string>,
) {
  return markdown.replace(
    /(!?\[[^\]]*]\()([^) \t]+)((?:\s+["'][^"']*["'])?\))/g,
    (full, before, path, after) =>
      replacements.has(path)
        ? `${before}${replacements.get(path)}${after}`
        : full,
  )
}

export async function exportProjectZip(options: {
  markdown: string
  title: string
  theme: ThemeName
  settings: PresentationSettings
  imageAssets: Record<string, string>
  htmlAssets: Record<string, string>
}) {
  const zip = new JSZip()
  const usedPaths = new Set<string>()
  const replacements = new Map<string, string>()
  const packagedAssets: Record<string, string> = {}

  Object.entries({
    ...options.imageAssets,
    ...options.htmlAssets,
  }).forEach(([sourcePath, dataUrl]) => {
    const packagedPath = safeAssetName(sourcePath, usedPaths)
    replacements.set(sourcePath, packagedPath)
    packagedAssets[packagedPath] = dataUrl
    zip.file(packagedPath, dataUrlToBlob(dataUrl))
  })

  const packagedMarkdown = rewriteMarkdownAssets(
    options.markdown,
    replacements,
  )
  const packagedPresentation = compileMarkdown(
    packagedMarkdown,
    options.settings.includeToc,
  )
  const packagedHtml = buildPresentationHtml(
    packagedPresentation,
    options.theme,
    false,
    packagedAssets,
    options.settings,
    packagedAssets,
  )
  const manifest: ProjectManifest = {
    format: 'deckdown-project',
    version: 1,
    title: options.title,
    theme: options.theme,
    settings: options.settings,
    markdownFile: 'document.md',
    htmlFile: 'presentation.html',
    createdAt: new Date().toISOString(),
  }

  zip.file('document.md', packagedMarkdown)
  zip.file('presentation.html', packagedHtml)
  zip.file('project.json', JSON.stringify(manifest, null, 2))
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  downloadBlob(blob, `${options.title || 'deckdown-project'}.zip`)
}

export async function importProjectZip(file: File) {
  const zip = await JSZip.loadAsync(file)
  const manifestEntry = zip.file('project.json')
  const manifest = manifestEntry
    ? (JSON.parse(await manifestEntry.async('string')) as ProjectManifest)
    : undefined
  if (manifest && manifest.format !== 'deckdown-project') {
    throw new Error('这不是 Deckdown 项目包。')
  }
  const markdownEntry =
    zip.file(manifest?.markdownFile || 'document.md') ||
    Object.values(zip.files).find(
      (entry) => !entry.dir && /\.md$/i.test(entry.name),
    )
  if (!markdownEntry) throw new Error('ZIP 中没有找到 Markdown 文件。')

  const assetEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && entry.name.startsWith('assets/'),
  )
  await Promise.all(
    assetEntries.map(async (entry) => {
      const bytes = await entry.async('uint8array')
      const copy = Uint8Array.from(bytes)
      const blob = new Blob([copy.buffer], {
        type: mimeTypeForPath(entry.name),
      })
      await storeBrowserAsset(entry.name, blob)
    }),
  )

  return {
    markdown: await markdownEntry.async('string'),
    theme: manifest?.theme,
    settings: manifest?.settings,
    assetCount: assetEntries.length,
  }
}

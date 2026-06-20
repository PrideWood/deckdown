import { readLogoSettingFrontmatter } from './markdown'

const DB_NAME = 'ready-slides'
const ASSET_STORE_NAME = 'assets'
const MAX_IMAGE_EDGE = 1920
const JPEG_QUALITY = 0.88

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(ASSET_STORE_NAME)) {
        request.result.createObjectStore(ASSET_STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function imageToBlob(file: File): Promise<{ blob: Blob; extension: string }> {
  if (
    file.type === 'image/gif' ||
    file.type === 'image/svg+xml' ||
    file.size < 350_000
  ) {
    return {
      blob: file,
      extension: file.name.split('.').pop()?.toLowerCase() || 'png',
    }
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return { blob: file, extension: 'png' }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const keepPng = file.type === 'image/png' && file.size < 1_500_000
  const outputType = keepPng ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outputType, JPEG_QUALITY),
  )
  return {
    blob: blob || file,
    extension: keepPng ? 'png' : 'jpg',
  }
}

function safeBaseName(fileName: string) {
  const base =
    fileName
      .replace(/\.[^.]+$/, '')
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image'
  return `${Date.now()}-${base}`
}

export async function saveImagesToProject(
  files: File[],
) {
  const markdown: string[] = []

  for (const file of files.filter((item) => item.type.startsWith('image/'))) {
    const relativePath = await saveImageAssetToProject(file)
    const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]\n\r]/g, '')
    markdown.push(`![${alt || '本地图片'}](${relativePath})`)
  }
  return markdown.length ? `\n\n${markdown.join('\n\n')}\n\n` : ''
}

export async function saveImageAssetToProject(file: File) {
  const { blob, extension } = await imageToBlob(file)
  const fileName = `${safeBaseName(file.name)}.${extension}`
  const relativePath = `images/${fileName}`
  await storeBrowserAsset(relativePath, blob)
  return relativePath
}

export async function saveHtmlFilesToProject(
  files: File[],
) {
  const links: string[] = []
  const assets: Record<string, string> = {}

  for (const file of files.filter(
    (item) => item.type === 'text/html' || /\.html?$/i.test(item.name),
  )) {
    const fileName = `${safeBaseName(file.name)}.html`
    const relativePath = `html/${fileName}`
    await storeBrowserAsset(relativePath, file)
    assets[relativePath] = await readAsDataUrl(file)
    const label = file.name.replace(/\.html?$/i, '').replace(/[[\]\n\r]/g, '')
    links.push(`[${label || '打开 HTML'}](${relativePath})`)
  }

  return {
    markdown: links.length ? `\n\n${links.join('\n\n')}\n\n` : '',
    assets,
  }
}

export async function storeBrowserAsset(path: string, blob: Blob) {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(ASSET_STORE_NAME, 'readwrite')
    transaction.objectStore(ASSET_STORE_NAME).put(blob, path)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

async function loadBrowserAsset(path: string) {
  const database = await openDatabase()
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const request = database
      .transaction(ASSET_STORE_NAME, 'readonly')
      .objectStore(ASSET_STORE_NAME)
      .get(path)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  database.close()
  return blob
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function resolveLocalImageAssets(
  markdown: string,
) {
  const paths = new Set<string>()
  for (const match of markdown.matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
    const path = match[1]
    if (!/^(?:https?:|data:|blob:|#)/i.test(path)) paths.add(path)
  }
  const { logo } = readLogoSettingFrontmatter(markdown)
  if (logo && !/^(?:https?:|data:|blob:|#)/i.test(logo)) paths.add(logo)

  const assets: Record<string, string> = {}
  await Promise.all(
    [...paths].map(async (path) => {
      try {
        let file = await loadBrowserAsset(path)
        if (!file) {
          const response = await fetch(path)
          if (response.ok) file = await response.blob()
        }
        if (file) assets[path] = await readAsDataUrl(file)
      } catch {
        // Missing images remain visible as broken links so the user can fix the path.
      }
    }),
  )
  return assets
}

export async function resolveLocalHtmlAssets(
  markdown: string,
) {
  const paths = new Set<string>()
  for (const match of markdown.matchAll(/\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
    const path = match[1]
    if (/\.html?(?:[?#].*)?$/i.test(path) && !/^(?:https?:|data:|blob:|file:|#)/i.test(path)) {
      paths.add(path)
    }
  }

  const assets: Record<string, string> = {}
  await Promise.all(
    [...paths].map(async (path) => {
      try {
        let file = await loadBrowserAsset(path)
        if (!file) {
          const response = await fetch(path)
          if (response.ok) file = await response.blob()
        }
        if (file) assets[path] = await readAsDataUrl(file)
      } catch {
        // Missing HTML files keep their original link for manual correction.
      }
    }),
  )
  return assets
}

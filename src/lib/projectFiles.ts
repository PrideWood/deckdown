const DB_NAME = 'ready-slides'
const STORE_NAME = 'handles'
const ASSET_STORE_NAME = 'assets'
const PROJECT_HANDLE_KEY = 'project-directory'
const MAX_IMAGE_EDGE = 1920
const JPEG_QUALITY = 0.88

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>
  }
}

interface PermissionCapableDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission: (options: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
  requestPermission: (options: {
    mode: 'read' | 'readwrite'
  }) => Promise<PermissionState>
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME)
      }
      if (!request.result.objectStoreNames.contains(ASSET_STORE_NAME)) {
        request.result.createObjectStore(ASSET_STORE_NAME)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function storeProjectHandle(handle: FileSystemDirectoryHandle) {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite')
    transaction.objectStore(STORE_NAME).put(handle, PROJECT_HANDLE_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

export async function loadProjectHandle() {
  const database = await openDatabase()
  const handle = await new Promise<FileSystemDirectoryHandle | undefined>(
    (resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(PROJECT_HANDLE_KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    },
  )
  database.close()
  return handle
}

export async function chooseProjectFolder() {
  if (!window.showDirectoryPicker) {
    throw new Error('当前浏览器不支持直接写入本地文件夹。请使用 Chromium 内核浏览器。')
  }
  const handle = await window.showDirectoryPicker()
  await storeProjectHandle(handle)
  return handle
}

export function supportsProjectFolder() {
  return typeof window.showDirectoryPicker === 'function'
}

async function ensurePermission(handle: FileSystemDirectoryHandle, write = false) {
  const permissionHandle = handle as PermissionCapableDirectoryHandle
  const options = {
    mode: write ? 'readwrite' : 'read',
  } as const
  if ((await permissionHandle.queryPermission(options)) === 'granted') return true
  return (await permissionHandle.requestPermission(options)) === 'granted'
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
  project?: FileSystemDirectoryHandle,
) {
  if (project && !(await ensurePermission(project, true))) {
    throw new Error('没有项目文件夹写入权限。')
  }
  const imageFolder = project
    ? await project.getDirectoryHandle('images', { create: true })
    : undefined
  const markdown: string[] = []

  for (const file of files.filter((item) => item.type.startsWith('image/'))) {
    const { blob, extension } = await imageToBlob(file)
    const fileName = `${safeBaseName(file.name)}.${extension}`
    const relativePath = `images/${fileName}`
    if (imageFolder) {
      const fileHandle = await imageFolder.getFileHandle(fileName, { create: true })
      const writer = await fileHandle.createWritable()
      await writer.write(blob)
      await writer.close()
    } else {
      await storeBrowserAsset(relativePath, blob)
    }
    const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]\n\r]/g, '')
    markdown.push(`![${alt || '本地图片'}](${relativePath})`)
  }
  return markdown.length ? `\n\n${markdown.join('\n\n')}\n\n` : ''
}

export async function saveHtmlFilesToProject(
  files: File[],
  project?: FileSystemDirectoryHandle,
) {
  if (project && !(await ensurePermission(project, true))) {
    throw new Error('没有项目文件夹写入权限。')
  }
  const htmlFolder = project
    ? await project.getDirectoryHandle('html', { create: true })
    : undefined
  const links: string[] = []
  const assets: Record<string, string> = {}

  for (const file of files.filter(
    (item) => item.type === 'text/html' || /\.html?$/i.test(item.name),
  )) {
    const fileName = `${safeBaseName(file.name)}.html`
    const relativePath = `html/${fileName}`
    if (htmlFolder) {
      const fileHandle = await htmlFolder.getFileHandle(fileName, { create: true })
      const writer = await fileHandle.createWritable()
      await writer.write(file)
      await writer.close()
    }
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

async function getFileByPath(
  root: FileSystemDirectoryHandle,
  relativePath: string,
) {
  const parts = decodeURIComponent(relativePath)
    .replace(/^[./]+/, '')
    .split('/')
    .filter(Boolean)
  let directory = root
  for (const part of parts.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(part)
  }
  const fileHandle = await directory.getFileHandle(parts.at(-1) || '')
  return fileHandle.getFile()
}

export async function resolveLocalImageAssets(
  markdown: string,
  project?: FileSystemDirectoryHandle,
) {
  const paths = new Set<string>()
  for (const match of markdown.matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
    const path = match[1]
    if (!/^(?:https?:|data:|blob:|#)/i.test(path)) paths.add(path)
  }

  const assets: Record<string, string> = {}
  await Promise.all(
    [...paths].map(async (path) => {
      try {
        let file: Blob | undefined
        if (project) {
          try {
            if (!(await ensurePermission(project))) throw new Error('No permission')
            file = await getFileByPath(project, path)
          } catch {
            file = undefined
          }
        }
        file ||= await loadBrowserAsset(path)
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
  project?: FileSystemDirectoryHandle,
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
        let file: Blob | undefined
        if (project) {
          try {
            if (!(await ensurePermission(project))) throw new Error('No permission')
            file = await getFileByPath(project, path)
          } catch {
            file = undefined
          }
        }
        file ||= await loadBrowserAsset(path)
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

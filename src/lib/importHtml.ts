import type { EmbeddedDeckdownProject } from './exportHtml'
import { storeBrowserAsset } from './projectFiles'

function dataUrlToBlob(dataUrl: string) {
  const [metadata, encoded = ''] = dataUrl.split(',', 2)
  const mime =
    metadata.match(/^data:([^;,]+)/)?.[1] || 'application/octet-stream'
  if (metadata.includes(';base64')) {
    const bytes = Uint8Array.from(atob(encoded), (character) =>
      character.charCodeAt(0),
    )
    return new Blob([bytes], { type: mime })
  }
  return new Blob([decodeURIComponent(encoded)], { type: mime })
}

export async function importDeckdownHtml(file: File) {
  const document = new DOMParser().parseFromString(
    await file.text(),
    'text/html',
  )
  const source = document.querySelector<HTMLScriptElement>(
    '#deckdown-project-data[type="application/json"]',
  )?.textContent
  if (!source) {
    throw new Error(
      '这个 HTML 不包含可编辑的 Deckdown 源数据。请使用新版 Deckdown 导出的独立 HTML。',
    )
  }

  const project = JSON.parse(source) as EmbeddedDeckdownProject
  if (
    project.format !== 'deckdown-html-project' ||
    project.version !== 1 ||
    typeof project.markdown !== 'string'
  ) {
    throw new Error('无法识别这个 Deckdown HTML 项目。')
  }

  const assets = {
    ...(project.imageAssets || {}),
    ...(project.htmlAssets || {}),
  }
  await Promise.all(
    Object.entries(assets).map(([path, dataUrl]) =>
      storeBrowserAsset(path, dataUrlToBlob(dataUrl)),
    ),
  )

  return {
    markdown: project.markdown,
    theme: project.theme,
    settings: project.settings,
    assetCount: Object.keys(assets).length,
  }
}

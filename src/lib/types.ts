export type SlideKind =
  | 'cover'
  | 'toc'
  | 'section'
  | 'untitled'
  | 'content'
  | 'quote'
  | 'image'

export interface Slide {
  id: string
  anchor: string
  kind: SlideKind
  title?: string
  level: number
  chapter: number
  markdown: string
  html: string
  continuation?: number
  sourceStart: number
  sourceEnd: number
}

export interface Presentation {
  title: string
  slides: Slide[]
  fingerprint: string
}

export type SlideRatio = '16:9' | '4:3'

export interface ComponentStyles {
  list: string
  code: string
  quote: string
  table: string
  image: string
}

export interface PresentationSettings {
  includeToc: boolean
  progressiveReveal: boolean
  imageShadow: boolean
  hideNavigationControls: boolean
  enableDrawing: boolean
  ratio: SlideRatio
  headingFont: string
  bodyFont: string
  headingScale: number
  bodyScale: number
  componentStyles: ComponentStyles
  themeCss: Record<string, string>
}

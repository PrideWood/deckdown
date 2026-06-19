export type ThemeName = 'paper' | 'midnight' | 'ocean' | 'warm' | 'custom'

export const themeLabels: Record<ThemeName, string> = {
  paper: '纸张',
  midnight: '午夜',
  ocean: '海洋',
  warm: '暖调',
  custom: '自定义',
}

export const fontChoices = [
  { label: '现代黑体', value: 'Inter, "Noto Sans CJK SC", system-ui, sans-serif' },
  { label: '人文宋体', value: '"Iowan Old Style", "Noto Serif CJK SC", serif' },
  { label: '系统字体', value: 'system-ui, "Noto Sans CJK SC", sans-serif' },
  { label: '等宽字体', value: '"SFMono-Regular", "Cascadia Code", monospace' },
]

export const themeStyles: Record<ThemeName, string> = {
  paper: `
    --slide-bg: #f8f5ed;
    --slide-fg: #22211e;
    --muted: #706d65;
    --accent: #b85c3f;
    --accent-soft: #e7d8c8;
    --code-bg: #eae5da;
    --cover-pattern:
      radial-gradient(circle at 86% 18%, #e7d8c8 0 12%, transparent 12.5%),
      linear-gradient(120deg, transparent 0 68%, #e7d8c8 68%);
    --font-heading: "Iowan Old Style", "Noto Serif CJK SC", serif;
    --font-body: Inter, "Noto Sans CJK SC", system-ui, sans-serif;
  `,
  midnight: `
    --slide-bg: #111318;
    --slide-fg: #f3f0e9;
    --muted: #aaa69e;
    --accent: #ffca68;
    --accent-soft: #3b3427;
    --code-bg: #20232b;
    --cover-pattern:
      radial-gradient(circle at 84% 20%, #3b3427 0 13%, transparent 13.5%),
      linear-gradient(135deg, transparent 0 70%, #272b35 70%);
    --font-heading: Inter, "Noto Sans CJK SC", system-ui, sans-serif;
    --font-body: Inter, "Noto Sans CJK SC", system-ui, sans-serif;
  `,
  ocean: `
    --slide-bg: #edf6f5;
    --slide-fg: #153b42;
    --muted: #53747a;
    --accent: #0d8493;
    --accent-soft: #c9e4e2;
    --code-bg: #dbeceb;
    --cover-pattern:
      radial-gradient(circle at 85% 18%, #c9e4e2 0 12%, transparent 12.5%),
      linear-gradient(115deg, transparent 0 66%, #c9e4e2 66%);
    --font-heading: "Iowan Old Style", "Noto Serif CJK SC", serif;
    --font-body: Inter, "Noto Sans CJK SC", system-ui, sans-serif;
  `,
  warm: `
    --slide-bg: #fff0e2;
    --slide-fg: #3d2926;
    --muted: #80615a;
    --accent: #df5d4f;
    --accent-soft: #f1c6a9;
    --code-bg: #f2ddce;
    --cover-pattern:
      radial-gradient(circle at 88% 16%, #f1c6a9 0 11%, transparent 11.5%),
      linear-gradient(125deg, transparent 0 69%, #f1c6a9 69%);
    --font-heading: "Iowan Old Style", "Noto Serif CJK SC", serif;
    --font-body: Inter, "Noto Sans CJK SC", system-ui, sans-serif;
  `,
  custom: `
    --slide-bg: #ffffff;
    --slide-fg: #111111;
    --muted: #666666;
    --accent: #111111;
    --accent-soft: #eeeeee;
    --code-bg: transparent;
    --cover-pattern: none;
    --font-heading: system-ui, "Noto Sans CJK SC", sans-serif;
    --font-body: system-ui, "Noto Sans CJK SC", sans-serif;
  `,
}

export function themeCssTemplate(theme: ThemeName) {
  return `:root {
${themeStyles[theme]
  .trim()
  .split('\n')
  .filter((line) => !line.includes('--font-'))
  .map((line) => `  ${line.trim()}`)
  .join('\n')}
}

/* 页面图案由封面背景规则实现。
 * 可修改 background，或替换成 linear-gradient / radial-gradient / url(...)。
 */
.reveal .slide-cover {
  background: var(--cover-pattern);
}

/* 当前主题的其他全局幻灯片样式 */
.reveal {
  /* font-size: 34px; */
}

.reveal .slides section {
  /* padding: 54px 70px; */
}

.reveal h1,
.reveal h2,
.reveal h3 {
  /* letter-spacing: -0.035em; */
}

`
}

export const defaultThemeCss = Object.fromEntries(
  (Object.keys(themeStyles) as ThemeName[]).map((theme) => [
    theme,
    themeCssTemplate(theme),
  ]),
) as Record<ThemeName, string>

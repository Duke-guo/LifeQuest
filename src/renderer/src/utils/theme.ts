export type Theme = 'light' | 'dark'

export function applyTheme(theme: string | undefined): void {
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light'
}

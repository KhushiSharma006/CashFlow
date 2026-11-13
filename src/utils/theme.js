export const THEME_STORAGE_KEY = 'cashflow-theme'

/**
 * Decides which theme to apply: an explicit stored choice always wins;
 * otherwise fall back to the system's prefers-color-scheme.
 */
export function resolveInitialTheme(storedTheme, systemPrefersDark) {
  if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
  return systemPrefersDark ? 'dark' : 'light'
}

export function toggleTheme(current) {
  return current === 'dark' ? 'light' : 'dark'
}

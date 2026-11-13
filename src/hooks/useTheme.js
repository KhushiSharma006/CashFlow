import { useEffect, useState } from 'react'
import { THEME_STORAGE_KEY, resolveInitialTheme, toggleTheme } from '../utils/theme'

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    return resolveInitialTheme(stored, systemPrefersDark)
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = () => {
    setTheme((current) => {
      const next = toggleTheme(current)
      localStorage.setItem(THEME_STORAGE_KEY, next)
      return next
    })
  }

  return { theme, toggle }
}

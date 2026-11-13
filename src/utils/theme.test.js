import { describe, it, expect } from 'vitest'
import { resolveInitialTheme, toggleTheme } from './theme'

describe('resolveInitialTheme', () => {
  it('uses the stored theme when it is "dark", regardless of system preference', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark')
  })

  it('uses the stored theme when it is "light", regardless of system preference', () => {
    expect(resolveInitialTheme('light', true)).toBe('light')
  })

  it('falls back to system dark preference when nothing is stored', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark')
  })

  it('falls back to system light preference when nothing is stored', () => {
    expect(resolveInitialTheme(null, false)).toBe('light')
  })

  it('falls back to system preference for an invalid stored value', () => {
    expect(resolveInitialTheme('sepia', true)).toBe('dark')
    expect(resolveInitialTheme('', false)).toBe('light')
  })
})

describe('toggleTheme', () => {
  it('flips dark to light', () => {
    expect(toggleTheme('dark')).toBe('light')
  })

  it('flips light to dark', () => {
    expect(toggleTheme('light')).toBe('dark')
  })
})

import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { Theme } from '@/stores/appStore'

/**
 * Applies the theme to the document root element.
 * - 'light': forces light mode via data-theme attribute
 * - 'dark': forces dark mode via data-theme attribute
 * - 'system': follows OS preference (default CSS behavior)
 */
export function useTheme() {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement

    const apply = (t: Theme) => {
      if (t === 'dark') {
        root.style.colorScheme = 'dark'
        root.classList.add('dark')
      } else if (t === 'light') {
        root.style.colorScheme = 'light'
        root.classList.remove('dark')
      } else {
        // system: let the browser decide
        root.style.colorScheme = ''
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', prefersDark)
      }
    }

    apply(theme)

    // Listen for OS theme changes when in system mode
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => {
        root.classList.toggle('dark', e.matches)
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])
}

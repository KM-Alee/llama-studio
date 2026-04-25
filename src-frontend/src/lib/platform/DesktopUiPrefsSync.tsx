import { useEffect } from 'react'
import { setUiPreferences } from '@/lib/api'
import { isDesktopRuntime } from '@/lib/platform/env'
import { useAppStore } from '@/stores/appStore'

/**
 * Persists `profile` / `theme` / `sidebarOpen` to SQLite on native desktop; web keeps Zustand persist in localStorage.
 */
export function DesktopUiPrefsSync() {
  useEffect(() => {
    if (!isDesktopRuntime()) {
      return
    }
    let last = ''
    return useAppStore.subscribe((s) => {
      const appPrefs = {
        profile: s.profile,
        theme: s.theme,
        sidebarOpen: s.sidebarOpen,
      }
      const key = JSON.stringify(appPrefs)
      if (key === last) {
        return
      }
      last = key
      setUiPreferences(appPrefs, undefined).catch(() => {})
    })
  }, [])

  return null
}

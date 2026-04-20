import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

export type Profile = 'normal' | 'advanced'
export type Theme = 'light' | 'dark' | 'system'

interface AppState {
  profile: Profile
  theme: Theme
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  setProfile: (profile: Profile) => void
  toggleProfile: () => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setCommandPaletteOpen: (open: boolean) => void
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

const APP_STORAGE_KEY = 'llamastudio-app'
const LEGACY_APP_STORAGE_KEY = 'ai-studio-app'

const appStorage = createJSONStorage(() => {
  if (
    typeof window === 'undefined' ||
    !window.localStorage ||
    typeof window.localStorage.getItem !== 'function' ||
    typeof window.localStorage.setItem !== 'function' ||
    typeof window.localStorage.removeItem !== 'function'
  ) {
    return noopStorage
  }

  return {
    getItem: (name) => {
      const current = window.localStorage.getItem(name)
      if (current != null) return current

      if (name === APP_STORAGE_KEY) {
        const legacy = window.localStorage.getItem(LEGACY_APP_STORAGE_KEY)
        if (legacy != null) {
          window.localStorage.setItem(APP_STORAGE_KEY, legacy)
          window.localStorage.removeItem(LEGACY_APP_STORAGE_KEY)
          return legacy
        }
      }

      return null
    },
    setItem: (name, value) => window.localStorage.setItem(name, value),
    removeItem: (name) => window.localStorage.removeItem(name),
  }
})

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      profile: 'normal',
      theme: 'light',
      sidebarOpen: true,
      commandPaletteOpen: false,
      setProfile: (profile) => set({ profile }),
      toggleProfile: () =>
        set((state) => ({
          profile: state.profile === 'normal' ? 'advanced' : 'normal',
        })),
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: APP_STORAGE_KEY,
      storage: appStorage,
      partialize: (state) => ({
        profile: state.profile,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    },
  ),
)

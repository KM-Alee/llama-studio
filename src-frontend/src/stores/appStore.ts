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

const appStorage = createJSONStorage(() => {
  if (
    typeof window !== 'undefined' &&
    window.localStorage &&
    typeof window.localStorage.getItem === 'function' &&
    typeof window.localStorage.setItem === 'function' &&
    typeof window.localStorage.removeItem === 'function'
  ) {
    return window.localStorage
  }

  return noopStorage
})

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      profile: 'normal',
      theme: 'system',
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
      name: 'ai-studio-app',
      storage: appStorage,
      partialize: (state) => ({
        profile: state.profile,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    },
  ),
)

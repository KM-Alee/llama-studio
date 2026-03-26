import { create } from 'zustand'

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

export const useAppStore = create<AppState>((set) => ({
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
}))

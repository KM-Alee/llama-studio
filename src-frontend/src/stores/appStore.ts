import { create } from 'zustand'

export type Profile = 'normal' | 'advanced'
export type Theme = 'light' | 'dark' | 'system'

interface AppState {
  profile: Profile
  theme: Theme
  sidebarOpen: boolean
  setProfile: (profile: Profile) => void
  toggleProfile: () => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
}

export const useAppStore = create<AppState>((set) => ({
  profile: 'normal',
  theme: 'system',
  sidebarOpen: true,
  setProfile: (profile) => set({ profile }),
  toggleProfile: () =>
    set((state) => ({
      profile: state.profile === 'normal' ? 'advanced' : 'normal',
    })),
  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}))

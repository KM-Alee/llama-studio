import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/stores/appStore'

function resetStore() {
  useAppStore.persist.clearStorage()
  useAppStore.setState({
    profile: 'normal',
    theme: 'system',
    sidebarOpen: true,
    commandPaletteOpen: false,
  })
}

describe('appStore', () => {
  beforeEach(resetStore)

  it('has correct initial state', () => {
    const state = useAppStore.getState()
    expect(state.profile).toBe('normal')
    expect(state.theme).toBe('system')
    expect(state.sidebarOpen).toBe(true)
    expect(state.commandPaletteOpen).toBe(false)
  })

  it('setProfile updates the profile', () => {
    useAppStore.getState().setProfile('advanced')
    expect(useAppStore.getState().profile).toBe('advanced')
  })

  it('toggleProfile switches normal → advanced', () => {
    useAppStore.getState().toggleProfile()
    expect(useAppStore.getState().profile).toBe('advanced')
  })

  it('toggleProfile switches advanced → normal', () => {
    useAppStore.setState({ profile: 'advanced' })
    useAppStore.getState().toggleProfile()
    expect(useAppStore.getState().profile).toBe('normal')
  })

  it('setTheme updates the theme', () => {
    useAppStore.getState().setTheme('dark')
    expect(useAppStore.getState().theme).toBe('dark')
  })

  it('toggleSidebar flips sidebarOpen', () => {
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarOpen).toBe(false)
    useAppStore.getState().toggleSidebar()
    expect(useAppStore.getState().sidebarOpen).toBe(true)
  })

  it('setCommandPaletteOpen sets value', () => {
    useAppStore.getState().setCommandPaletteOpen(true)
    expect(useAppStore.getState().commandPaletteOpen).toBe(true)
    useAppStore.getState().setCommandPaletteOpen(false)
    expect(useAppStore.getState().commandPaletteOpen).toBe(false)
  })
})

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'

/**
 * Global keyboard shortcuts:
 * - Ctrl+Shift+N: New chat
 * - Ctrl+Shift+S: Toggle sidebar
 * - Ctrl+Shift+P: Command palette
 * - Ctrl+Shift+M: Navigate to Models page
 * - Ctrl+K: Command palette (alternative)
 * - Ctrl+,: Navigate to Settings
 * - Escape: Cancel streaming or close palette
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const cancelStreaming = useChatStore((s) => s.cancelStreaming)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      if (ctrl && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        useChatStore.getState().setActiveConversation(null)
        useChatStore.getState().setMessages([])
        navigate('/chat')
        return
      }

      if (ctrl && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      if ((ctrl && e.shiftKey && e.key === 'P') || (ctrl && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        const store = useAppStore.getState()
        store.setCommandPaletteOpen(!store.commandPaletteOpen)
        return
      }

      if (ctrl && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        navigate('/models')
        return
      }

      if (ctrl && e.key === ',') {
        e.preventDefault()
        navigate('/settings')
        return
      }

      if (e.key === 'Escape') {
        const appStore = useAppStore.getState()
        if (appStore.commandPaletteOpen) {
          e.preventDefault()
          appStore.setCommandPaletteOpen(false)
          return
        }

        if (useChatStore.getState().isStreaming) {
          e.preventDefault()
          cancelStreaming()
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cancelStreaming, navigate, toggleSidebar])
}

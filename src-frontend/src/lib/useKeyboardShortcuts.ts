import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'

/**
 * Global keyboard shortcuts:
 * - Ctrl+Shift+N: New chat
 * - Ctrl+Shift+S: Toggle sidebar
 * - Ctrl+Shift+P: Toggle profile (normal/advanced)
 * - Ctrl+Shift+M: Navigate to Models page
 * - Ctrl+,: Navigate to Settings
 * - Escape: Cancel streaming (when active)
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate()
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const toggleProfile = useAppStore((s) => s.toggleProfile)
  const setStreaming = useChatStore((s) => s.setStreaming)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+Shift+N: New chat
      if (ctrl && e.shiftKey && e.key === 'N') {
        e.preventDefault()
        useChatStore.getState().setActiveConversation(null)
        useChatStore.getState().setMessages([])
        navigate('/chat')
        return
      }

      // Ctrl+Shift+S: Toggle sidebar
      if (ctrl && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      // Ctrl+Shift+P: Toggle profile
      if (ctrl && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        toggleProfile()
        return
      }

      // Ctrl+Shift+M: Models page
      if (ctrl && e.shiftKey && e.key === 'M') {
        e.preventDefault()
        navigate('/models')
        return
      }

      // Ctrl+,: Settings
      if (ctrl && e.key === ',') {
        e.preventDefault()
        navigate('/settings')
        return
      }

      // Escape: Cancel streaming
      if (e.key === 'Escape') {
        const store = useChatStore.getState()
        if (store.isStreaming) {
          e.preventDefault()
          setStreaming(false)
        }
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, toggleSidebar, toggleProfile, setStreaming])
}

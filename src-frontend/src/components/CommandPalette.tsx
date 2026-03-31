import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MessageSquare, Settings, Box, Sun, Moon, Monitor, Zap } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { searchConversations, type Conversation } from '@/lib/api'

interface Command {
  id: string
  label: string
  category: string
  icon: React.ReactNode
  action: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchResults, setSearchResults] = useState<Conversation[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const toggleProfile = useAppStore((s) => s.toggleProfile)
  const setTheme = useAppStore((s) => s.setTheme)
  const profile = useAppStore((s) => s.profile)

  // Reset state when palette opens (derived-state-from-props pattern)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setQuery('')
      setSearchResults([])
      setSelectedIndex(0)
    }
  }

  // Focus input when opened
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Async conversation search — only sets state inside async callback
  useEffect(() => {
    if (query.length < 2) return
    const timeout = setTimeout(() => {
      searchConversations(query)
        .then((data) => setSearchResults(data.conversations || []))
        .catch(() => setSearchResults([]))
    }, 200)
    return () => clearTimeout(timeout)
  }, [query])

  const staticCommands: Command[] = useMemo(() => [
    {
      id: 'new-chat',
      label: 'New Chat',
      category: 'Navigation',
      icon: <MessageSquare className="w-4 h-4" />,
      action: () => { navigate('/chat'); onClose() },
    },
    {
      id: 'models',
      label: 'Models',
      category: 'Navigation',
      icon: <Box className="w-4 h-4" />,
      action: () => { navigate('/models'); onClose() },
    },
    {
      id: 'settings',
      label: 'Settings',
      category: 'Navigation',
      icon: <Settings className="w-4 h-4" />,
      action: () => { navigate('/settings'); onClose() },
    },
    {
      id: 'theme-light',
      label: 'Theme: Light',
      category: 'Theme',
      icon: <Sun className="w-4 h-4" />,
      action: () => { setTheme('light'); onClose() },
    },
    {
      id: 'theme-dark',
      label: 'Theme: Dark',
      category: 'Theme',
      icon: <Moon className="w-4 h-4" />,
      action: () => { setTheme('dark'); onClose() },
    },
    {
      id: 'theme-system',
      label: 'Theme: System',
      category: 'Theme',
      icon: <Monitor className="w-4 h-4" />,
      action: () => { setTheme('system'); onClose() },
    },
    {
      id: 'toggle-profile',
      label: `Switch to ${profile === 'normal' ? 'Advanced' : 'Normal'} Mode`,
      category: 'Profile',
      icon: <Zap className="w-4 h-4" />,
      action: () => { toggleProfile(); onClose() },
    },
  ], [navigate, onClose, setTheme, toggleProfile, profile])

  const conversationCommands: Command[] = useMemo(() =>
    query.length >= 2
      ? searchResults.map((c) => ({
          id: `convo-${c.id}`,
          label: c.title,
          category: 'Conversations',
          icon: <MessageSquare className="w-4 h-4" />,
          action: () => { navigate(`/chat/${c.id}`); onClose() },
        }))
      : [],
    [query, searchResults, navigate, onClose]
  )

  const allCommands = useMemo(() => [
    ...staticCommands.filter((c) =>
      c.label.toLowerCase().includes(query.toLowerCase())
    ),
    ...conversationCommands,
  ], [staticCommands, query, conversationCommands])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, allCommands.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      allCommands[selectedIndex]?.action()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [allCommands, selectedIndex, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        className="relative w-full max-w-lg bg-surface border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search conversations..."
            className="flex-1 bg-transparent text-text text-sm outline-none placeholder-text-muted"
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] text-text-muted border border-border rounded bg-surface-dim">
            ESC
          </kbd>
        </div>

        <div className="max-h-72 overflow-y-auto py-1">
          {allCommands.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-text-muted">
              No results found
            </div>
          ) : (
            allCommands.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors ${
                  i === selectedIndex
                    ? 'bg-primary/10 text-primary'
                    : 'text-text hover:bg-surface-hover'
                }`}
              >
                <span className="text-text-muted">{cmd.icon}</span>
                <span className="flex-1">{cmd.label}</span>
                <span className="text-[10px] text-text-muted">{cmd.category}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

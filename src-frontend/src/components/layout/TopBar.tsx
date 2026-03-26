import { useQuery } from '@tanstack/react-query'
import { PanelLeft, Download, GitFork, Search, Zap } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useServerStore } from '@/stores/serverStore'
import { useChatStore } from '@/stores/chatStore'
import { getServerStatus, exportConversationMarkdown, exportConversationJson, forkConversation } from '@/lib/api'
import { ModelSelector } from './ModelSelector'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export function TopBar() {
  const navigate = useNavigate()
  const profile = useAppStore((s) => s.profile)
  const toggleProfile = useAppStore((s) => s.toggleProfile)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const serverStatus = useServerStore((s) => s.status)
  const setStatus = useServerStore((s) => s.setStatus)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const [showExport, setShowExport] = useState(false)

  const { data } = useQuery({
    queryKey: ['server-status'],
    queryFn: getServerStatus,
    refetchInterval: 3000,
  })

  useEffect(() => {
    if (data?.status) {
      setStatus(data.status as any)
    }
  }, [data, setStatus])

  const statusColor = {
    stopped: 'bg-text-muted',
    starting: 'bg-warning animate-pulse',
    running: 'bg-success',
    stopping: 'bg-warning animate-pulse',
    error: 'bg-error',
  }[serverStatus]

  return (
    <header className="h-12 border-b border-border flex items-center justify-between px-3 bg-surface shrink-0">
      <div className="flex items-center gap-2">
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted transition-colors"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <div className={cn('w-1.5 h-1.5 rounded-full', statusColor)} />
          <span className="capitalize">{serverStatus}</span>
        </div>

        <div className="w-px h-4 bg-border mx-1" />

        <ModelSelector />
      </div>

      <div className="flex items-center gap-1">
        {/* Chat actions */}
        {activeConversationId && (
          <>
            <div className="relative">
              <button
                onClick={() => setShowExport(!showExport)}
                className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted transition-colors"
                title="Export"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              {showExport && (
                <div className="absolute top-full right-0 mt-1 w-44 bg-surface border border-border rounded-lg shadow-lg z-50 py-1">
                  <button
                    onClick={async () => {
                      try {
                        const md = await exportConversationMarkdown(activeConversationId)
                        const blob = new Blob([md], { type: 'text/markdown' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'conversation.md'
                        a.click()
                        URL.revokeObjectURL(url)
                        setShowExport(false)
                        toast.success('Exported as Markdown')
                      } catch { toast.error('Export failed') }
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-text transition-colors"
                  >
                    Markdown
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const data = await exportConversationJson(activeConversationId)
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = 'conversation.json'
                        a.click()
                        URL.revokeObjectURL(url)
                        setShowExport(false)
                        toast.success('Exported as JSON')
                      } catch { toast.error('Export failed') }
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover hover:text-text transition-colors"
                  >
                    JSON
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={async () => {
                try {
                  const forked = await forkConversation(activeConversationId)
                  toast.success('Conversation forked')
                  navigate(`/chat/${forked.id}`)
                } catch { toast.error('Fork failed') }
              }}
              className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted transition-colors"
              title="Fork"
            >
              <GitFork className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-border mx-0.5" />
          </>
        )}

        {/* Command Palette */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted transition-colors"
          title="Search (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        {/* Profile Toggle */}
        <button
          onClick={toggleProfile}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
            profile === 'advanced'
              ? 'bg-primary/10 text-primary'
              : 'text-text-muted hover:bg-surface-hover'
          )}
        >
          <Zap className="w-3 h-3" />
          {profile === 'normal' ? 'Normal' : 'Advanced'}
        </button>
      </div>
    </header>
  )
}

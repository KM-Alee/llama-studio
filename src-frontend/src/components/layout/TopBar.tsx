import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PanelLeft, Download, GitFork, Search, Zap, Pencil } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useServerStore, type ServerStatus } from '@/stores/serverStore'
import { useChatStore } from '@/stores/chatStore'
import {
  getConversations,
  getServerStatus,
  exportConversationMarkdown,
  exportConversationJson,
  forkConversation,
  updateConversation,
} from '@/lib/api'
import { ModelSelector } from './ModelSelector'
import { InputModal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

function slugifyFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug.slice(0, 48) || 'conversation'
}

export function TopBar() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const profile = useAppStore((s) => s.profile)
  const toggleProfile = useAppStore((s) => s.toggleProfile)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const serverStatus = useServerStore((s) => s.status)
  const setStatus = useServerStore((s) => s.setStatus)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const [showExport, setShowExport] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['server-status'],
    queryFn: getServerStatus,
    staleTime: 30_000,
  })

  const { data: conversationsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
  })

  useEffect(() => {
    if (data?.status) {
      setStatus(data.status as ServerStatus)
    }
  }, [data, setStatus])

  const currentConversation = useMemo(
    () =>
      conversationsData?.conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ) ?? null,
    [activeConversationId, conversationsData?.conversations],
  )

  const renameMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!activeConversationId) {
        throw new Error('No active conversation')
      }

      return updateConversation(activeConversationId, { title })
    },
    onSuccess: () => {
      toast.success('Conversation renamed')
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      if (activeConversationId) {
        queryClient.invalidateQueries({ queryKey: ['conversation', activeConversationId] })
      }
    },
    onError: (error: Error) => toast.error(error.message || 'Rename failed'),
  })

  const statusColor = {
    stopped: 'bg-text-muted',
    starting: 'bg-warning animate-pulse',
    running: 'bg-success',
    stopping: 'bg-warning animate-pulse',
    error: 'bg-error',
  }[serverStatus]

  const statusLabel = {
    stopped: 'Stopped',
    starting: 'Starting…',
    running: 'Running',
    stopping: 'Stopping…',
    error: 'Error',
  }[serverStatus]

  const exportBaseName = slugifyFilename(currentConversation?.title ?? 'conversation')

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b-2 border-border bg-surface px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        {!sidebarOpen && (
          <>
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt=""
                aria-hidden="true"
                className="h-8 w-8 shrink-0 border-2 border-border bg-surface-dim object-cover"
              />
              <span className="hidden font-mono text-xs font-black uppercase tracking-[0.2em] text-text sm:inline">
                LLAMASTUDIO
              </span>
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              className="ui-icon-button"
              title="Open sidebar"
              aria-label="Open sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="hidden items-center gap-2 sm:flex">
          <div className={cn('w-2 h-2', statusColor)} />
          <span className="font-mono text-xs uppercase tracking-widest text-text-muted">
            {statusLabel}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        <ModelSelector />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {activeConversationId && (
          <>
            <button
              type="button"
              onClick={() => setRenameOpen(true)}
              className="ui-icon-button"
              title="Rename conversation"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExport(!showExport)}
                className="ui-icon-button"
                title="Export"
              >
                <Download className="w-4 h-4" />
              </button>
              {showExport && (
                <div className="ui-panel absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden py-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const markdown = await exportConversationMarkdown(activeConversationId)
                        const blob = new Blob([markdown], { type: 'text/markdown' })
                        const url = URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        link.download = `${exportBaseName}.md`
                        link.click()
                        URL.revokeObjectURL(url)
                        setShowExport(false)
                        toast.success('Exported as Markdown')
                      } catch {
                        toast.error('Export failed')
                      }
                    }}
                    className="w-full px-4 py-2 text-left font-mono text-xs uppercase tracking-wider text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
                  >
                    Markdown
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const conversation = await exportConversationJson(activeConversationId)
                        const blob = new Blob([JSON.stringify(conversation, null, 2)], {
                          type: 'application/json',
                        })
                        const url = URL.createObjectURL(blob)
                        const link = document.createElement('a')
                        link.href = url
                        link.download = `${exportBaseName}.json`
                        link.click()
                        URL.revokeObjectURL(url)
                        setShowExport(false)
                        toast.success('Exported as JSON')
                      } catch {
                        toast.error('Export failed')
                      }
                    }}
                    className="w-full px-4 py-2 text-left font-mono text-xs uppercase tracking-wider text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
                  >
                    JSON
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const forked = await forkConversation(activeConversationId)
                  toast.success('Conversation forked')
                  navigate(`/chat/${forked.id}`)
                } catch {
                  toast.error('Fork failed')
                }
              }}
              className="ui-icon-button"
              title="Fork conversation"
            >
              <GitFork className="w-4 h-4" />
            </button>
            <div className="mx-1 h-4 w-px bg-border" />
          </>
        )}

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="ui-icon-button"
          title="Search (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={toggleProfile}
          className={cn(
            'hidden items-center gap-1.5 border-2 px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest transition-colors sm:flex',
            profile === 'advanced'
              ? 'border-primary bg-primary/8 text-primary'
              : 'border-border text-text-muted hover:border-text-muted hover:bg-surface-hover hover:text-text',
          )}
        >
          <Zap className="w-3 h-3" />
          {profile === 'normal' ? 'Normal' : 'Advanced'}
        </button>
      </div>

      <InputModal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        onSubmit={(title) => renameMutation.mutate(title)}
        title="Rename conversation"
        description="Give this chat a clearer title so it is easier to find later."
        placeholder="Conversation title"
        submitLabel="Rename"
        initialValue={currentConversation?.title ?? ''}
      />
    </header>
  )
}

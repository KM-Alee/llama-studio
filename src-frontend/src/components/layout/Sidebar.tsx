import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  MessageSquare,
  Box,
  Activity,
  Settings,
  Search,
  PanelLeftClose,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'
import {
  getConversations,
  deleteConversation,
  updateConversation,
  searchConversations,
  type Conversation,
} from '@/lib/api'
import { cn, formatDate } from '@/lib/utils'
import { ConfirmModal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
  })

  const searchTerm = searchQuery.trim()
  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['conversation-search', searchTerm],
    queryFn: () => searchConversations(searchTerm),
    enabled: searchTerm.length >= 2,
  })

  const allConversations = data?.conversations ?? []
  const conversations =
    searchTerm.length >= 2 ? (searchResults?.conversations ?? []) : allConversations

  const handleDelete = async (conversationId: string) => {
    try {
      await deleteConversation(conversationId)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Chat deleted')
      if (activeConversationId === conversationId) {
        useChatStore.getState().setActiveConversation(null)
        useChatStore.getState().setMessages([])
        navigate('/chat')
      }
    } catch {
      toast.error('Failed to delete chat')
    }
  }

  const handleRename = async (conversationId: string, newTitle: string) => {
    const trimmed = newTitle.trim()
    setRenameTarget(null)
    if (!trimmed) return
    try {
      await updateConversation(conversationId, { title: trimmed })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch {
      toast.error('Failed to rename chat')
    }
  }

  const handleNewChat = () => {
    useChatStore.getState().setActiveConversation(null)
    useChatStore.getState().setMessages([])
    navigate('/chat')
  }

  const navItems = [
    { path: '/models', label: 'Models', icon: Box },
    {
      path: '/models/analytics',
      label: 'Analytics',
      icon: Activity,
      match: (p: string) => p.startsWith('/models/analytics'),
    },
    { path: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-full w-64 flex-col border-r-2 border-border bg-surface-dim transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b-2 border-border px-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            className="h-9 w-9 shrink-0 border-2 border-border bg-surface-dim object-cover"
          />
          <span className="font-mono text-xs font-black uppercase tracking-[0.2em] text-text">
            LLAMASTUDIO
          </span>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="ui-icon-button h-8 w-8"
          title="Close sidebar"
          aria-label="Close sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* New chat + Search */}
      <div className="space-y-2 border-b border-border px-3 py-3">
        <button
          type="button"
          onClick={handleNewChat}
          className="ui-button ui-button-primary w-full"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>

        <div className="flex items-center gap-2 border border-border bg-surface px-3 py-2 text-sm">
          <Search className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-text outline-none placeholder-text-muted"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading ? (
          <div className="px-4 py-8 text-center font-mono text-xs uppercase tracking-wider text-text-muted">
            Loading…
          </div>
        ) : isError ? (
          <div className="px-4 py-8 text-center text-xs text-error">
            Failed to load conversations.
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-text-muted">
            {searchTerm.length >= 2
              ? isSearching
                ? 'Searching…'
                : 'No matching chats.'
              : 'No conversations yet.'}
          </div>
        ) : (
          <div>
            {conversations.map((conversation: Conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  'group flex items-center gap-1 transition-colors',
                  activeConversationId === conversation.id
                    ? 'border-l-2 border-l-primary bg-surface-hover'
                    : 'border-l-2 border-l-transparent hover:bg-surface-hover/70',
                )}
              >
                {renameTarget === conversation.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRename(conversation.id, renameValue)
                      if (e.key === 'Escape') setRenameTarget(null)
                      e.stopPropagation()
                    }}
                    onBlur={() => void handleRename(conversation.id, renameValue)}
                    onClick={(e) => e.stopPropagation()}
                    className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-text outline-none border-b border-primary"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate(`/chat/${conversation.id}`)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left"
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 text-text-muted/60" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm leading-snug text-text">
                        {conversation.title}
                      </span>
                      <span className="block font-mono text-[10px] text-text-muted">
                        {formatDate(conversation.updated_at)}
                      </span>
                    </span>
                  </button>
                )}
                <div className="flex shrink-0 items-center gap-0.5 pr-2 opacity-0 transition-all group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRenameTarget(conversation.id)
                      setRenameValue(conversation.title)
                    }}
                    className="ui-icon-button h-7 w-7 hover:text-primary"
                    title="Rename"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(conversation.id)
                    }}
                    className="ui-icon-button h-7 w-7 hover:text-error"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="border-t-2 border-border">
        {navItems.map(({ path, label, icon: Icon, match }) => {
          const isActive = match ? match(location.pathname) : location.pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                'flex w-full items-center gap-3 border-l-2 px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-l-primary bg-surface-hover text-text'
                  : 'border-l-transparent text-text-secondary hover:bg-surface-hover/60 hover:text-text',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          )
        })}
      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void handleDelete(deleteTarget)
        }}
        title="Delete conversation"
        description="This conversation and all its messages will be permanently deleted."
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </aside>
  )
}

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
  Trash2,
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'
import { getConversations, deleteConversation, type Conversation } from '@/lib/api'
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

  const { data } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
  })

  const allConversations = data?.conversations ?? []
  const conversations = searchQuery
    ? allConversations.filter((c: Conversation) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allConversations

  const handleDelete = async (convoId: string) => {
    try {
      await deleteConversation(convoId)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Chat deleted')
      if (activeConversationId === convoId) {
        useChatStore.getState().setActiveConversation(null)
        useChatStore.getState().setMessages([])
        navigate('/chat')
      }
    } catch {
      toast.error('Failed to delete chat')
    }
  }

  const handleNewChat = () => {
    useChatStore.getState().setActiveConversation(null)
    useChatStore.getState().setMessages([])
    navigate('/chat')
  }

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full w-72 bg-surface-dim flex flex-col z-40 transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-14 shrink-0 border-b border-border/50">
        <span className="text-sm font-bold text-text tracking-tight">
          Llama Studio
        </span>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
          title="Close sidebar"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* New Chat + Search */}
      <div className="px-3 pt-3 pb-1 space-y-2">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover transition-colors text-sm font-semibold"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>

        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-hover/60 text-sm">
          <Search className="w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-text placeholder-text-muted text-sm"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 pt-1">
        {conversations.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-10 px-4">
            {searchQuery ? 'No matching chats.' : 'No conversations yet.'}
          </div>
        ) : (
          <div className="space-y-0.5">
            {conversations.map((convo: Conversation) => (
              <div
                key={convo.id}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors cursor-pointer',
                  activeConversationId === convo.id
                    ? 'bg-surface-hover text-text'
                    : 'hover:bg-surface-hover/60 text-text-secondary'
                )}
                onClick={() => navigate(`/chat/${convo.id}`)}
              >
                <MessageSquare className="w-4 h-4 shrink-0 opacity-40" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm leading-snug">{convo.title}</div>
                  <div className="text-xs text-text-muted mt-0.5">{formatDate(convo.updated_at)}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(convo.id) }}
                  className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:text-error hover:bg-error/10 text-text-muted transition-all shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="border-t border-border p-2 space-y-0.5">
        <button
          onClick={() => navigate('/models')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
            location.pathname === '/models'
              ? 'bg-surface-hover text-text'
              : 'hover:bg-surface-hover/60 text-text-secondary'
          )}
        >
          <Box className="w-4 h-4" />
          Models
        </button>
        <button
          onClick={() => navigate('/models/analytics')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
            location.pathname.startsWith('/models/analytics')
              ? 'bg-surface-hover text-text'
              : 'hover:bg-surface-hover/60 text-text-secondary'
          )}
        >
          <Activity className="w-4 h-4" />
          Analytics
        </button>
        <button
          onClick={() => navigate('/settings')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
            location.pathname === '/settings'
              ? 'bg-surface-hover text-text'
              : 'hover:bg-surface-hover/60 text-text-secondary'
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget) }}
        title="Delete conversation"
        description="This conversation and all its messages will be permanently deleted."
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </aside>
  )
}

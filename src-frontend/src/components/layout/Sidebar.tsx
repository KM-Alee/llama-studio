import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  MessageSquare,
  Box,
  Settings,
  Search,
  PanelLeftClose,
  Trash2,
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'
import { getConversations, deleteConversation, type Conversation } from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const [searchQuery, setSearchQuery] = useState('')

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

  const handleDelete = async (e: React.MouseEvent, convoId: string) => {
    e.stopPropagation()
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return
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

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full w-64 bg-surface-dim flex flex-col z-40 transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 shrink-0">
        <span className="text-sm font-semibold text-text tracking-tight">
          AI Studio
        </span>
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-md hover:bg-surface-hover text-text-muted transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* New Chat */}
      <div className="px-3 pb-2">
        <button
          onClick={() => {
            useChatStore.getState().setActiveConversation(null)
            useChatStore.getState().setMessages([])
            navigate('/chat')
          }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-hover/60 text-sm">
          <Search className="w-3.5 h-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-text placeholder-text-muted text-xs"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2">
        {conversations.length === 0 ? (
          <div className="text-center text-text-muted text-xs py-8 px-4">
            {searchQuery ? 'No matching chats.' : 'No conversations yet.'}
          </div>
        ) : (
          <div className="space-y-px">
            {conversations.map((convo: Conversation) => (
              <div
                key={convo.id}
                className={cn(
                  'group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer',
                  activeConversationId === convo.id
                    ? 'bg-surface-hover text-text'
                    : 'hover:bg-surface-hover/60 text-text-secondary'
                )}
                onClick={() => navigate(`/chat/${convo.id}`)}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-40" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{convo.title}</div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, convo.id)}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:text-error text-text-muted transition-all shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="border-t border-border p-2 space-y-px">
        <button
          onClick={() => navigate('/models')}
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
            location.pathname === '/models'
              ? 'bg-surface-hover text-text'
              : 'hover:bg-surface-hover/60 text-text-secondary'
          )}
        >
          <Box className="w-4 h-4" />
          Models
        </button>
        <button
          onClick={() => navigate('/settings')}
          className={cn(
            'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors',
            location.pathname === '/settings'
              ? 'bg-surface-hover text-text'
              : 'hover:bg-surface-hover/60 text-text-secondary'
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </aside>
  )
}

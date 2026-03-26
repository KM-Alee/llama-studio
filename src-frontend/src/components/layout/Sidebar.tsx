import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  MessageSquarePlus,
  MessageSquare,
  Box,
  Settings,
  Search,
  ChevronLeft,
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'
import { getConversations } from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'

export function Sidebar() {
  const navigate = useNavigate()
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const activeConversationId = useChatStore((s) => s.activeConversationId)

  const { data } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
  })

  const conversations = data?.conversations ?? []

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full w-72 bg-surface-dim border-r border-border flex flex-col z-40 transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h1 className="text-lg font-semibold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
          AI Studio
        </h1>
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-surface-hover text-text-secondary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* New Chat */}
      <div className="p-3">
        <button
          onClick={() => navigate('/chat')}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors font-medium text-sm"
        >
          <MessageSquarePlus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border text-sm">
          <Search className="w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search chats..."
            className="flex-1 bg-transparent outline-none text-text placeholder-text-muted"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2">
        {conversations.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-8 px-4">
            No conversations yet. Start a new chat!
          </div>
        ) : (
          conversations.map((convo: any) => (
            <button
              key={convo.id}
              onClick={() => navigate(`/chat/${convo.id}`)}
              className={cn(
                'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors mb-0.5',
                activeConversationId === convo.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-surface-hover text-text-secondary'
              )}
            >
              <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{convo.title}</div>
                <div className="text-xs text-text-muted mt-0.5">
                  {formatDate(convo.updated_at)}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Bottom Nav */}
      <div className="border-t border-border p-2 space-y-0.5">
        <button
          onClick={() => navigate('/models')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover text-text-secondary text-sm transition-colors"
        >
          <Box className="w-4 h-4" />
          Models
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-hover text-text-secondary text-sm transition-colors"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </aside>
  )
}

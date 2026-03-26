import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MessageSquarePlus,
  MessageSquare,
  Box,
  Settings,
  Search,
  ChevronLeft,
  Trash2,
} from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { useChatStore } from '@/stores/chatStore'
import { getConversations, deleteConversation } from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import toast from 'react-hot-toast'

export function Sidebar() {
  const navigate = useNavigate()
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
    ? allConversations.filter((c: any) =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allConversations

  const handleDelete = async (e: React.MouseEvent, convoId: string) => {
    e.stopPropagation()
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
          onClick={() => {
            useChatStore.getState().setActiveConversation(null)
            useChatStore.getState().setMessages([])
            navigate('/chat')
          }}
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-text placeholder-text-muted"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2">
        {conversations.length === 0 ? (
          <div className="text-center text-text-muted text-sm py-8 px-4">
            {searchQuery ? 'No matching conversations.' : 'No conversations yet. Start a new chat!'}
          </div>
        ) : (
          conversations.map((convo: any) => (
            <div
              key={convo.id}
              className={cn(
                'group flex items-start gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors mb-0.5 cursor-pointer',
                activeConversationId === convo.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-surface-hover text-text-secondary'
              )}
              onClick={() => navigate(`/chat/${convo.id}`)}
            >
              <MessageSquare className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{convo.title}</div>
                <div className="text-xs text-text-muted mt-0.5">
                  {formatDate(convo.updated_at)}
                </div>
              </div>
              <button
                onClick={(e) => handleDelete(e, convo.id)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-error/10 hover:text-error text-text-muted transition-all shrink-0"
                title="Delete chat"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
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

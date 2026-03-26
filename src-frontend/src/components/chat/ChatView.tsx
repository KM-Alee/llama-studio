import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { Send, Square, Sparkles } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useChatStore } from '@/stores/chatStore'
import { useAppStore } from '@/stores/appStore'
import { useServerStore } from '@/stores/serverStore'
import {
  streamChat,
  getPresets,
  getConversation,
  createConversation,
  addMessage,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { MessageBubble } from './MessageBubble'
import { PresetSelector } from './PresetSelector'

export function ChatView() {
  const { conversationId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [input, setInput] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const messages = useChatStore((s) => s.messages)
  const setMessages = useChatStore((s) => s.setMessages)
  const addLocalMessage = useChatStore((s) => s.addMessage)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const setActiveConversation = useChatStore((s) => s.setActiveConversation)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const setStreaming = useChatStore((s) => s.setStreaming)
  const streamingContent = useChatStore((s) => s.streamingContent)
  const appendStreamContent = useChatStore((s) => s.appendStreamContent)
  const clearStreamContent = useChatStore((s) => s.clearStreamContent)
  const serverStatus = useServerStore((s) => s.status)
  const profile = useAppStore((s) => s.profile)

  const { data: presetsData } = useQuery({
    queryKey: ['presets'],
    queryFn: getPresets,
  })

  // Load conversation + messages when navigating to an existing conversation
  useEffect(() => {
    if (conversationId && conversationId !== activeConversationId) {
      setActiveConversation(conversationId)
      getConversation(conversationId).then((data) => {
        const msgs = data.messages.map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          createdAt: m.created_at,
          tokensUsed: m.tokens_used,
          generationTimeMs: m.generation_time_ms,
        }))
        setMessages(msgs)
      }).catch(() => {
        // Conversation not found — reset
        setMessages([])
        setActiveConversation(null)
      })
    } else if (!conversationId) {
      // New chat — clear state
      setActiveConversation(null)
      setMessages([])
    }
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    setInput('')
    setStreaming(true)
    clearStreamContent()

    try {
      // If no active conversation, create one
      let convoId = activeConversationId
      if (!convoId) {
        const title = trimmed.length > 50 ? trimmed.slice(0, 50) + '...' : trimmed
        const convo = await createConversation({
          title,
          preset_id: selectedPresetId ?? undefined,
        })
        convoId = convo.id
        setActiveConversation(convoId)
        navigate(`/chat/${convoId}`, { replace: true })
        queryClient.invalidateQueries({ queryKey: ['conversations'] })
      }

      // Save user message to backend
      const userMsgResponse = await addMessage(convoId, {
        role: 'user',
        content: trimmed,
      })

      const userMsg = {
        id: userMsgResponse.id,
        role: 'user' as const,
        content: trimmed,
        createdAt: userMsgResponse.created_at,
      }
      addLocalMessage(userMsg)

      // Build the full message history to send to llama.cpp
      const chatMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      // Stream the response
      let fullContent = ''
      for await (const chunk of streamChat(chatMessages)) {
        fullContent += chunk
        appendStreamContent(chunk)
      }

      // Save assistant message to backend
      const assistantMsgResponse = await addMessage(convoId, {
        role: 'assistant',
        content: fullContent,
      })

      addLocalMessage({
        id: assistantMsgResponse.id,
        role: 'assistant',
        content: fullContent,
        createdAt: assistantMsgResponse.created_at,
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      toast.error(errorMsg)
      addLocalMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${errorMsg}`,
        createdAt: new Date().toISOString(),
      })
    } finally {
      setStreaming(false)
      clearStreamContent()
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isServerReady = serverStatus === 'running'

  // Rough token count estimate (~4 chars per token for English)
  const estimatedTokens = Math.ceil(input.length / 4)

  // Auto-resize textarea to its content
  const autoResize = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [])

  useEffect(() => {
    autoResize()
  }, [input, autoResize])

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted gap-4">
            <Sparkles className="w-12 h-12 text-primary/30" />
            <div className="text-center">
              <h2 className="text-xl font-semibold text-text mb-2">Start a conversation</h2>
              <p className="text-sm max-w-md">
                {isServerReady
                  ? 'Type a message below to start chatting with your model.'
                  : 'Start a model first from the Models page, then come back to chat.'}
              </p>
            </div>

            {/* Quick Presets */}
            {isServerReady && presetsData?.presets && (
              <div className="flex flex-wrap gap-2 mt-4 max-w-lg justify-center">
                {presetsData.presets.slice(0, 4).map((preset: any) => (
                  <button
                    key={preset.id}
                    className="px-3 py-1.5 rounded-full bg-surface-dim border border-border text-xs text-text-secondary hover:bg-surface-hover hover:text-text transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && streamingContent && (
              <MessageBubble
                message={{
                  id: 'streaming',
                  role: 'assistant',
                  content: streamingContent,
                  createdAt: new Date().toISOString(),
                }}
                isStreaming
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-surface p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-end gap-2 bg-surface-dim border border-border rounded-2xl p-3 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isServerReady
                  ? 'Type a message... (Shift+Enter for new line)'
                  : 'Start a model to begin chatting...'
              }
              disabled={!isServerReady}
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-text placeholder-text-muted text-sm max-h-[200px] min-h-[36px] py-1.5 disabled:opacity-50"
            />
            <button
              onClick={isStreaming ? () => setStreaming(false) : handleSend}
              disabled={!isServerReady || (!input.trim() && !isStreaming)}
              className={cn(
                'p-2 rounded-xl transition-colors shrink-0',
                isStreaming
                  ? 'bg-error text-white hover:bg-error/80'
                  : 'bg-primary text-white hover:bg-primary-hover disabled:opacity-30 disabled:cursor-not-allowed'
              )}
            >
              {isStreaming ? (
                <Square className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <PresetSelector
              selectedPresetId={selectedPresetId}
              onSelect={setSelectedPresetId}
            />
            {profile === 'advanced' && (
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <span>{input.length} chars</span>
                <span>·</span>
                <span>~{estimatedTokens} tokens</span>
                <span>·</span>
                <button className="hover:text-text transition-colors">Parameters</button>
                <span>·</span>
                <button className="hover:text-text transition-colors">System Prompt</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

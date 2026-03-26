import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { Send, Square, RotateCcw, Sparkles } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useChatStore } from '@/stores/chatStore'
import { useAppStore } from '@/stores/appStore'
import { useServerStore } from '@/stores/serverStore'
import { streamChat, getPresets } from '@/lib/api'
import { cn } from '@/lib/utils'
import { MessageBubble } from './MessageBubble'

export function ChatView() {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messages = useChatStore((s) => s.messages)
  const addMessage = useChatStore((s) => s.addMessage)
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: trimmed,
      createdAt: new Date().toISOString(),
    }

    addMessage(userMsg)
    setInput('')
    setStreaming(true)
    clearStreamContent()

    try {
      const chatMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }))

      for await (const chunk of streamChat(chatMessages)) {
        appendStreamContent(chunk)
      }

      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: useChatStore.getState().streamingContent,
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        createdAt: new Date().toISOString(),
      })
    } finally {
      setStreaming(false)
      clearStreamContent()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isServerReady = serverStatus === 'running'

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
              className="flex-1 bg-transparent resize-none outline-none text-text placeholder-text-muted text-sm max-h-40 min-h-[36px] py-1.5 disabled:opacity-50"
              style={{ height: 'auto', overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
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
          {profile === 'advanced' && (
            <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
              <span>{input.length} chars</span>
              <span>·</span>
              <button className="hover:text-text transition-colors">Parameters</button>
              <span>·</span>
              <button className="hover:text-text transition-colors">System Prompt</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

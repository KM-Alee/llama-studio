import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { ArrowUp, Square, MessageCircle, SlidersHorizontal, FileText, Terminal, RotateCcw, Gauge } from 'lucide-react'
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
  type Message,
  type Preset,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { MessageBubble } from './MessageBubble'
import { PresetSelector } from './PresetSelector'
import { ParameterPanel, DEFAULT_PARAMS, type InferenceParams } from './ParameterPanel'
import { SystemPromptEditor } from './SystemPromptEditor'
import { LogViewer } from './LogViewer'

type SidePanel = 'params' | 'system-prompt' | 'logs' | null

export function ChatView() {
  const { conversationId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [input, setInput] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [sidePanel, setSidePanel] = useState<SidePanel>(null)
  const [inferenceParams, setInferenceParams] = useState<InferenceParams>({ ...DEFAULT_PARAMS })
  const [systemPrompt, setSystemPrompt] = useState('')
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null)
  const [streamTokenCount, setStreamTokenCount] = useState(0)
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
        const msgs = data.messages.map((m: Message) => ({
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

  // Streaming speed calculation
  const tokensPerSecond = streamStartTime && streamTokenCount > 0
    ? (streamTokenCount / ((Date.now() - streamStartTime) / 1000)).toFixed(1)
    : null

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    setInput('')
    setStreaming(true)
    clearStreamContent()
    setStreamStartTime(Date.now())
    setStreamTokenCount(0)

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
      const chatMessages = [...messages, userMsg]
        .filter((m) => !m.isError)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }))

      // Stream the response, passing inference params if in advanced mode
      let fullContent = ''
      const chatOptions = profile === 'advanced' ? {
        ...inferenceParams,
        system_prompt: systemPrompt || undefined,
      } : undefined
      abortRef.current = new AbortController()
      for await (const chunk of streamChat(chatMessages, chatOptions, abortRef.current.signal)) {
        fullContent += chunk
        appendStreamContent(chunk)
        // Rough token counting for speed display (split on whitespace + punctuation boundaries)
        setStreamTokenCount((prev) => prev + 1)
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
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast.error(errorMsg)
      addLocalMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `⚠️ Error: ${errorMsg}`,
        createdAt: new Date().toISOString(),
        isError: true,
      })
    } finally {
      abortRef.current = null
      setStreaming(false)
      clearStreamContent()
      setStreamStartTime(null)
      setStreamTokenCount(0)
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    }
  }

  const handleRegenerate = async () => {
    if (isStreaming || messages.length < 2) return
    // Remove the last assistant message and re-send
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (!lastAssistant) return
    const newMessages = messages.filter((m) => m.id !== lastAssistant.id)
    setMessages(newMessages)

    // Re-build message history and stream
    setStreaming(true)
    clearStreamContent()
    setStreamStartTime(Date.now())
    setStreamTokenCount(0)

    try {
      const chatMessages = newMessages
        .filter((m) => !m.isError)
        .map((m) => ({ role: m.role, content: m.content }))

      let fullContent = ''
      const chatOptions = profile === 'advanced' ? {
        ...inferenceParams,
        system_prompt: systemPrompt || undefined,
      } : undefined
      abortRef.current = new AbortController()
      for await (const chunk of streamChat(chatMessages, chatOptions, abortRef.current.signal)) {
        fullContent += chunk
        appendStreamContent(chunk)
        setStreamTokenCount((prev) => prev + 1)
      }

      const convoId = activeConversationId
      if (convoId) {
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
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast.error(errorMsg)
    } finally {
      abortRef.current = null
      setStreaming(false)
      clearStreamContent()
      setStreamStartTime(null)
      setStreamTokenCount(0)
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
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 px-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-primary/60" />
              </div>
              <div className="text-center max-w-md">
                <h2 className="text-lg font-bold text-text mb-2">Start a conversation</h2>
                <p className="text-sm text-text-muted leading-relaxed">
                  {isServerReady
                    ? 'Type a message below to begin. Pick a style to set the tone.'
                    : 'Load a model from the Models page to begin chatting.'}
                </p>
              </div>

              {isServerReady && presetsData?.presets && (
                <div className="flex flex-wrap gap-2 mt-1 max-w-lg justify-center">
                  {presetsData.presets.slice(0, 4).map((preset: Preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setSelectedPresetId(preset.id)
                        inputRef.current?.focus()
                      }}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-medium transition-colors",
                        selectedPresetId === preset.id
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "bg-surface-dim text-text-secondary hover:bg-surface-hover hover:text-text border border-border"
                      )}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto py-6 px-6 space-y-5">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isStreaming && (
                <MessageBubble
                  message={{
                    id: 'streaming',
                    role: 'assistant',
                    content: streamingContent || '...',
                    createdAt: new Date().toISOString(),
                  }}
                  isStreaming
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Streaming speed indicator */}
        {isStreaming && tokensPerSecond && (
          <div className="flex items-center justify-center gap-1.5 py-1 text-xs text-text-muted">
            <Gauge className="w-3 h-3" />
            <span>{tokensPerSecond} tok/s</span>
          </div>
        )}

        {/* Input Area */}
        <div className="bg-surface px-4 pb-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end gap-2 bg-surface-dim border border-border rounded-2xl p-3 focus-within:border-text-muted/40 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isServerReady
                    ? 'Message...'
                    : 'Load a model to start chatting...'
                }
                disabled={!isServerReady}
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-text placeholder-text-muted text-sm leading-relaxed max-h-[200px] min-h-[36px] py-1 px-1 disabled:opacity-40"
              />
              <div className="flex items-center gap-1 shrink-0">
                {messages.length >= 2 && !isStreaming && isServerReady && (
                  <button
                    onClick={handleRegenerate}
                    className="p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                    title="Regenerate last response"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={isStreaming ? () => {
                    abortRef.current?.abort()
                    setStreaming(false)
                    clearStreamContent()
                  } : handleSend}
                  disabled={!isServerReady || (!input.trim() && !isStreaming)}
                  className={cn(
                    'p-2 rounded-xl transition-colors shrink-0',
                    isStreaming
                      ? 'bg-error text-white hover:bg-error/80'
                      : 'bg-primary text-white hover:bg-primary-hover disabled:opacity-20 disabled:cursor-not-allowed'
                  )}
                >
                  {isStreaming ? (
                    <Square className="w-4 h-4" />
                  ) : (
                    <ArrowUp className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <PresetSelector
                selectedPresetId={selectedPresetId}
                onSelect={setSelectedPresetId}
              />
              {profile === 'advanced' && (
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <span>{input.length}c / ~{estimatedTokens}t</span>
                  <div className="w-px h-3 bg-border" />
                  <button
                    onClick={() => setSidePanel(sidePanel === 'params' ? null : 'params')}
                    className={cn(
                      'p-1.5 rounded-lg hover:text-text hover:bg-surface-hover transition-colors',
                      sidePanel === 'params' && 'text-primary bg-primary/10'
                    )}
                    title="Parameters"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSidePanel(sidePanel === 'system-prompt' ? null : 'system-prompt')}
                    className={cn(
                      'p-1.5 rounded-lg hover:text-text hover:bg-surface-hover transition-colors',
                      sidePanel === 'system-prompt' && 'text-primary bg-primary/10'
                    )}
                    title="System Prompt"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSidePanel(sidePanel === 'logs' ? null : 'logs')}
                    className={cn(
                      'p-1.5 rounded-lg hover:text-text hover:bg-surface-hover transition-colors',
                      sidePanel === 'logs' && 'text-primary bg-primary/10'
                    )}
                    title="Logs"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Side panels (advanced mode) */}
      {profile === 'advanced' && sidePanel === 'params' && (
        <ParameterPanel
          params={inferenceParams}
          onChange={setInferenceParams}
          onClose={() => setSidePanel(null)}
        />
      )}
      {profile === 'advanced' && sidePanel === 'system-prompt' && (
        <SystemPromptEditor
          value={systemPrompt}
          onChange={setSystemPrompt}
          onClose={() => setSidePanel(null)}
        />
      )}
      {profile === 'advanced' && sidePanel === 'logs' && (
        <LogViewer onClose={() => setSidePanel(null)} />
      )}
    </div>
  )
}

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type DragEvent, type ChangeEvent } from 'react'
import { ArrowUp, Square, MessageCircle, SlidersHorizontal, FileText, Terminal, RotateCcw, Gauge, Paperclip, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { useChatStore, type ChatMessage } from '@/stores/chatStore'
import { useAppStore } from '@/stores/appStore'
import { useModelStore } from '@/stores/modelStore'
import { useServerStore } from '@/stores/serverStore'
import {
  streamChat,
  getConversation,
  createConversation,
  addMessage,
  type Message,
  type MessageAttachment,
} from '@/lib/api'
import { attachmentInputHint, buildMessageForModel, toMessageAttachment } from '@/lib/chatAttachments'
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
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [isDragActive, setIsDragActive] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  const activeModelId = useModelStore((s) => s.activeModelId)
  const profile = useAppStore((s) => s.profile)

  // Load conversation + messages when navigating to an existing conversation
  useEffect(() => {
    if (conversationId && conversationId !== activeConversationId) {
      setActiveConversation(conversationId)
      getConversation(conversationId).then((data) => {
        const msgs = data.messages.map((m: Message) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          attachments: m.attachments ?? [],
          createdAt: m.created_at,
          tokensUsed: m.tokens_used ?? undefined,
          generationTimeMs: m.generation_time_ms ?? undefined,
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
    if ((!trimmed && attachments.length === 0) || isStreaming) return

    const currentAttachments = attachments

    setInput('')
    setAttachments([])
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
          title: title || `Files: ${currentAttachments.map((attachment) => attachment.name).join(', ').slice(0, 50)}`,
          model_id: activeModelId ?? undefined,
          preset_id: selectedPresetId || undefined,
          system_prompt: profile === 'advanced' ? systemPrompt || undefined : undefined,
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
        attachments: currentAttachments,
      })

      const userMsg: ChatMessage = {
        id: userMsgResponse.id,
        role: 'user' as const,
        content: trimmed,
        attachments: currentAttachments,
        createdAt: userMsgResponse.created_at,
      }
      addLocalMessage(userMsg)

      // Build the full message history to send to llama.cpp
      const chatMessages = [...messages, userMsg]
        .filter((m) => !m.isError)
        .map((m) => ({
          role: m.role,
          content: buildMessageForModel(m),
        }))

      // Stream the response, passing inference params if in advanced mode
      let fullContent = ''
      let assistantChunkCount = 0
      const generationStartedAt = Date.now()
      const chatOptions = profile === 'advanced' ? {
        ...inferenceParams,
        system_prompt: systemPrompt || undefined,
      } : undefined
      abortRef.current = new AbortController()
      for await (const chunk of streamChat(chatMessages, chatOptions, abortRef.current.signal)) {
        fullContent += chunk
        appendStreamContent(chunk)
        assistantChunkCount += 1
        setStreamTokenCount((prev) => prev + 1)
      }

      const estimatedTokensUsed = Math.max(assistantChunkCount, Math.ceil(fullContent.length / 4))
      // Save assistant message to backend
      const assistantMsgResponse = await addMessage(convoId, {
        role: 'assistant',
        content: fullContent,
        tokens_used: estimatedTokensUsed,
        generation_time_ms: Date.now() - generationStartedAt,
      })

      addLocalMessage({
        id: assistantMsgResponse.id,
        role: 'assistant',
        content: fullContent,
        attachments: [],
        createdAt: assistantMsgResponse.created_at,
        tokensUsed: assistantMsgResponse.tokens_used ?? undefined,
        generationTimeMs: assistantMsgResponse.generation_time_ms ?? undefined,
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      if (err instanceof DOMException && err.name === 'AbortError') return
      toast.error(errorMsg)
      setAttachments(currentAttachments)
      addLocalMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${errorMsg}`,
        attachments: [],
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
        .map((m) => ({ role: m.role, content: buildMessageForModel(m) }))

      let fullContent = ''
      let assistantChunkCount = 0
      const generationStartedAt = Date.now()
      const chatOptions = profile === 'advanced' ? {
        ...inferenceParams,
        system_prompt: systemPrompt || undefined,
      } : undefined
      abortRef.current = new AbortController()
      for await (const chunk of streamChat(chatMessages, chatOptions, abortRef.current.signal)) {
        fullContent += chunk
        appendStreamContent(chunk)
        assistantChunkCount += 1
        setStreamTokenCount((prev) => prev + 1)
      }

      const convoId = activeConversationId
      if (convoId) {
        const estimatedTokensUsed = Math.max(assistantChunkCount, Math.ceil(fullContent.length / 4))
        const assistantMsgResponse = await addMessage(convoId, {
          role: 'assistant',
          content: fullContent,
          tokens_used: estimatedTokensUsed,
          generation_time_ms: Date.now() - generationStartedAt,
        })
        addLocalMessage({
          id: assistantMsgResponse.id,
          role: 'assistant',
          content: fullContent,
          attachments: [],
          createdAt: assistantMsgResponse.created_at,
          tokensUsed: assistantMsgResponse.tokens_used ?? undefined,
          generationTimeMs: assistantMsgResponse.generation_time_ms ?? undefined,
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
  const estimatedTokens = Math.ceil((input.length + attachments.reduce((sum, attachment) => sum + attachment.content.length, 0)) / 4)

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

  const handleFilesAdded = useCallback(async (files: File[]) => {
    const nextAttachments: MessageAttachment[] = []

    for (const file of files) {
      try {
        nextAttachments.push(await toMessageAttachment(file))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : `Failed to attach ${file.name}`)
      }
    }

    if (nextAttachments.length > 0) {
      setAttachments((current) => [...current, ...nextAttachments])
    }
  }, [])

  const handleFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length > 0) {
      await handleFilesAdded(files)
    }
    event.target.value = ''
  }

  const handleDropFiles = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragActive(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      await handleFilesAdded(files)
    }
  }

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 px-4">
              <div className="relative w-16 h-16 rounded-2xl border border-primary/20 bg-primary/12 flex items-center justify-center overflow-hidden">
                <div className="absolute -top-5 -left-5 h-12 w-12 rounded-full bg-primary/20 blur-md" />
                <MessageCircle className="relative w-8 h-8 fill-current text-primary" />
              </div>
              <div className="text-center max-w-md">
                <h2 className="text-lg font-bold text-text mb-2">Start a conversation</h2>
                <p className="text-sm text-text-muted leading-relaxed">
                  {isServerReady
                    ? 'Type a message below to begin.'
                    : 'Load a model from the Models page to begin chatting.'}
                </p>
              </div>
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
            <div
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragActive(true)
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
                setIsDragActive(false)
              }}
              onDrop={handleDropFiles}
              className={cn(
                'relative rounded-3xl border bg-surface-dim p-3 transition-colors focus-within:border-text-muted/40',
                isDragActive ? 'border-primary bg-primary/5' : 'border-border'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileInput}
                className="hidden"
                accept=".c,.cc,.cpp,.css,.csv,.go,.h,.hpp,.html,.java,.js,.json,.jsx,.kt,.log,.md,.php,.py,.rb,.rs,.sh,.sql,.svg,.toml,.ts,.tsx,.txt,.xml,.yaml,.yml,text/*"
              />

              {attachments.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary"
                    >
                      <span className="max-w-[220px] truncate font-medium text-text">{attachment.name}</span>
                      <span>{Math.ceil(attachment.size_bytes / 1024)} KB</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                        className="rounded-full p-0.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="relative flex items-end gap-2">
                <PresetSelector 
                  selectedPresetId={selectedPresetId}
                  onSelect={setSelectedPresetId}
                />
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
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!isServerReady || isStreaming}
                    className="p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface-hover transition-colors disabled:opacity-30"
                    title={attachmentInputHint()}
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
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
              {isDragActive && (
                <div className="pointer-events-none mt-3 rounded-2xl border border-dashed border-primary/45 bg-primary/6 px-4 py-3 text-center text-xs font-medium text-primary">
                  Drop files here to attach them to this turn.
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center justify-end px-1">
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

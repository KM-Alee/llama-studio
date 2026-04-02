import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type DragEvent, type ChangeEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowUp,
  Square,
  SlidersHorizontal,
  FileText,
  Terminal,
  RotateCcw,
  Gauge,
  Paperclip,
  X,
} from 'lucide-react'
import { useChatStore, type ChatMessage } from '@/stores/chatStore'
import { useAppStore } from '@/stores/appStore'
import { useModelStore } from '@/stores/modelStore'
import { useServerStore } from '@/stores/serverStore'
import {
  streamChat,
  getConversation,
  createConversation,
  addMessage,
  deleteMessage,
  getPresets,
  type Message,
  type MessageAttachment,
  type Preset,
} from '@/lib/api'
import { attachmentInputHint, buildMessageForModel, toMessageAttachment } from '@/lib/chatAttachments'
import { cn } from '@/lib/utils'
import { useCustomTemplates } from '@/lib/customTemplates'
import toast from 'react-hot-toast'
import { MessageBubble } from './MessageBubble'
import { PresetSelector } from './PresetSelector'
import { ParameterPanel, DEFAULT_PARAMS, type InferenceParams } from './ParameterPanel'
import { SystemPromptEditor } from './SystemPromptEditor'
import { LogViewer } from './LogViewer'

type SidePanel = 'params' | 'system-prompt' | 'logs' | null

function estimateTokensFromText(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4))
}

function toChatMessage(message: Message): ChatMessage {
  return {
    id: message.id,
    role: message.role as 'user' | 'assistant' | 'system',
    content: message.content,
    attachments: message.attachments ?? [],
    createdAt: message.created_at,
    tokensUsed: message.tokens_used ?? undefined,
    generationTimeMs: message.generation_time_ms ?? undefined,
  }
}

function normalizePresetParameters(parameters: Record<string, unknown>): Partial<InferenceParams> {
  const next: Partial<InferenceParams> = {}
  const keys = Object.keys(DEFAULT_PARAMS) as Array<keyof InferenceParams>

  for (const key of keys) {
    const value = parameters[key]
    if (typeof value === 'number') {
      next[key] = value
    }
  }

  return next
}

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
  const registerAbortStreaming = useChatStore((s) => s.registerAbortStreaming)
  const cancelStreaming = useChatStore((s) => s.cancelStreaming)
  const serverStatus = useServerStore((s) => s.status)
  const activeModelId = useModelStore((s) => s.activeModelId)
  const profile = useAppStore((s) => s.profile)
  const { customTemplates } = useCustomTemplates()

  const { data: conversationData, isLoading: conversationLoading, isError: conversationLoadFailed } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId!),
    enabled: Boolean(conversationId),
  })

  const { data: presetsData } = useQuery({
    queryKey: ['presets'],
    queryFn: getPresets,
  })

  const presets = presetsData?.presets ?? []
  const allPresets = [...presets, ...customTemplates]
  const selectedPreset = allPresets.find((preset) => preset.id === selectedPresetId) ?? null

  useEffect(() => {
    if (!conversationId) {
      setActiveConversation(null)
      setMessages([])
      setSelectedPresetId(null)
      setSystemPrompt('')
      return
    }

    if (conversationData) {
      setActiveConversation(conversationId)
      setMessages(conversationData.messages.map(toChatMessage))
      setSelectedPresetId(conversationData.conversation.preset_id)
      setSystemPrompt(conversationData.conversation.system_prompt ?? '')
    }
  }, [conversationData, conversationId, setActiveConversation, setMessages])

  useEffect(() => {
    if (conversationId && conversationLoadFailed) {
      setMessages([])
      setActiveConversation(null)
    }
  }, [conversationId, conversationLoadFailed, setActiveConversation, setMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const tokensPerSecond = streamStartTime && streamTokenCount > 0
    ? (streamTokenCount / ((Date.now() - streamStartTime) / 1000)).toFixed(1)
    : null

  const attachAbortController = (controller: AbortController | null) => {
    abortRef.current = controller
    registerAbortStreaming(controller ? () => controller.abort() : null)
  }

  const beginStreaming = () => {
    setStreaming(true)
    clearStreamContent()
    setStreamStartTime(Date.now())
    setStreamTokenCount(0)
  }

  const finishStreaming = () => {
    attachAbortController(null)
    setStreaming(false)
    clearStreamContent()
    setStreamStartTime(null)
    setStreamTokenCount(0)
  }

  const buildChatMessages = (sourceMessages: ChatMessage[]) =>
    sourceMessages
      .filter((message) => !message.isError)
      .map((message) => ({
        role: message.role,
        content: buildMessageForModel(message),
      }))

  const buildChatOptions = () => {
    const presetParameters = selectedPreset ? normalizePresetParameters(selectedPreset.parameters) : {}
    const options: Record<string, unknown> = profile === 'advanced'
      ? {
          ...presetParameters,
          ...inferenceParams,
        }
      : {
          ...presetParameters,
        }

    const prompt = systemPrompt || selectedPreset?.system_prompt || undefined
    if (prompt) {
      options.system_prompt = prompt
    }

    return Object.keys(options).length > 0 ? options : undefined
  }

  const streamAssistantReply = async (
    conversation: string,
    chatMessages: { role: string; content: string }[],
  ) => {
    let fullContent = ''
    const generationStartedAt = Date.now()
    const controller = new AbortController()
    attachAbortController(controller)

    for await (const chunk of streamChat(chatMessages, buildChatOptions(), controller.signal)) {
      fullContent += chunk
      appendStreamContent(chunk)
      setStreamTokenCount((currentCount) => currentCount + estimateTokensFromText(chunk))
    }

    const assistantMessageResponse = await addMessage(conversation, {
      role: 'assistant',
      content: fullContent,
      tokens_used: estimateTokensFromText(fullContent),
      generation_time_ms: Date.now() - generationStartedAt,
    })

    addLocalMessage({
      id: assistantMessageResponse.id,
      role: 'assistant',
      content: fullContent,
      attachments: [],
      createdAt: assistantMessageResponse.created_at,
      tokensUsed: assistantMessageResponse.tokens_used ?? undefined,
      generationTimeMs: assistantMessageResponse.generation_time_ms ?? undefined,
    })
  }

  const handlePresetSelect = (preset: Preset | null) => {
    setSelectedPresetId(preset?.id ?? null)

    if (!preset) {
      setInferenceParams({ ...DEFAULT_PARAMS })
      setSystemPrompt('')
      return
    }

    setInferenceParams({
      ...DEFAULT_PARAMS,
      ...normalizePresetParameters(preset.parameters),
    })
    setSystemPrompt(preset.system_prompt ?? '')
  }

  const handleSend = async () => {
    const trimmed = input.trim()
    if ((!trimmed && attachments.length === 0) || isStreaming) return

    const currentAttachments = [...attachments]
    let conversation = activeConversationId
    let userMessageSaved = false

    setInput('')
    setAttachments([])
    beginStreaming()

    try {
      if (!conversation) {
        const title = trimmed
          ? (trimmed.length > 50 ? `${trimmed.slice(0, 50)}...` : trimmed)
          : `Files: ${currentAttachments.map((attachment) => attachment.name).join(', ').slice(0, 50)}`

        const createdConversation = await createConversation({
          title,
          model_id: activeModelId ?? undefined,
          preset_id: selectedPresetId ?? undefined,
          system_prompt: systemPrompt || selectedPreset?.system_prompt || undefined,
        })
        conversation = createdConversation.id
        setActiveConversation(conversation)
        navigate(`/chat/${conversation}`, { replace: true })
      }

      const userMessageResponse = await addMessage(conversation, {
        role: 'user',
        content: trimmed,
        attachments: currentAttachments,
      })
      userMessageSaved = true

      const userMessage: ChatMessage = {
        id: userMessageResponse.id,
        role: 'user',
        content: trimmed,
        attachments: currentAttachments,
        createdAt: userMessageResponse.created_at,
      }
      addLocalMessage(userMessage)

      await streamAssistantReply(conversation, buildChatMessages([...messages, userMessage]))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (!userMessageSaved) {
          setInput(trimmed)
          setAttachments(currentAttachments)
        }
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (!userMessageSaved) {
        setInput(trimmed)
        setAttachments(currentAttachments)
      }
      toast.error(errorMessage)
      addLocalMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        attachments: [],
        createdAt: new Date().toISOString(),
        isError: true,
      })
    } finally {
      finishStreaming()
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      if (conversation) {
        queryClient.invalidateQueries({ queryKey: ['conversation', conversation] })
      }
    }
  }

  const handleRegenerate = async () => {
    if (isStreaming || messages.length < 2 || !activeConversationId) return

    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
    if (!lastAssistant) return

    const previousMessages = messages
    const nextMessages = messages.filter((message) => message.id !== lastAssistant.id)
    setMessages(nextMessages)
    beginStreaming()

    try {
      await streamAssistantReply(activeConversationId, buildChatMessages(nextMessages))
      try {
        await deleteMessage(activeConversationId, lastAssistant.id)
      } catch {
        toast.error('Regenerated response saved, but the previous answer could not be removed')
      }
    } catch (error) {
      setMessages(previousMessages)
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(errorMessage)
    } finally {
      finishStreaming()
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['conversation', activeConversationId] })
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  const isServerReady = serverStatus === 'running'
  const estimatedTokens = Math.ceil((input.length + attachments.reduce((sum, attachment) => sum + attachment.content.length, 0)) / 4)

  const autoResize = useCallback(() => {
    const element = inputRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`
  }, [])

  useEffect(() => {
    autoResize()
  }, [autoResize, input])

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

  const showConversationLoading = Boolean(conversationId) && conversationLoading && messages.length === 0

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {showConversationLoading ? (
            <div className="flex h-full items-center justify-center">
              <span className="font-mono text-xs uppercase tracking-widest text-text-muted">Loading…</span>
            </div>
          ) : conversationLoadFailed ? (
            <div className="flex h-full items-center justify-center px-6">
              <div className="max-w-md border-2 border-border bg-surface-dim px-6 py-6 text-center">
                <h2 className="text-base font-bold text-text">Conversation unavailable</h2>
                <p className="mt-2 text-sm text-text-muted">
                  This chat could not be loaded. It may have been deleted or moved.
                </p>
                <button
                  onClick={() => navigate('/chat')}
                  className="mt-4 border-2 border-primary bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  New chat
                </button>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
              <div className="flex h-14 w-14 items-center justify-center border-2 border-border bg-surface-dim rounded-full overflow-hidden">
                <img src="/ai-face.jpeg" alt="AI avatar" className="h-full w-full object-cover" />
              </div>
              <div className="max-w-sm text-center">
                <h2 className="mb-1.5 font-mono text-xl font-black uppercase tracking-tight text-text">
                  What's on your mind?
                </h2>
                <p className="text-sm text-text-muted">
                  {isServerReady
                    ? 'Type a message below to start a conversation.'
                    : 'Load a model from the Models page to begin.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-7 px-6 py-8">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isStreaming && (
                <MessageBubble
                  message={{
                    id: 'streaming',
                    role: 'assistant',
                    content: streamingContent || '',
                    createdAt: new Date().toISOString(),
                  }}
                  isStreaming
                />
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Live tok/s indicator */}
        {isStreaming && tokensPerSecond && (
          <div className="flex items-center justify-center gap-2 py-1 border-t border-border bg-surface-dim">
            <Gauge className="w-3 h-3 text-text-muted" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tokensPerSecond} tok/s</span>
          </div>
        )}

        {/* Input area */}
        <div className="border-t-2 border-border bg-surface px-4 pb-5 pt-4">
          <div className="mx-auto max-w-3xl">
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
                'border-2 bg-surface-dim transition-colors',
                isDragActive ? 'border-primary' : 'border-border focus-within:border-text-muted',
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
                <div className="flex flex-wrap gap-1.5 border-b border-border px-3 pt-2 pb-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center gap-1.5 border border-border bg-surface px-2.5 py-1 font-mono text-xs"
                    >
                      <span className="max-w-[180px] truncate text-text">{attachment.name}</span>
                      <span className="text-text-muted">{Math.ceil(attachment.size_bytes / 1024)}K</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                        className="text-text-muted transition-colors hover:text-error"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end gap-2 px-3 py-2.5">
                <PresetSelector selectedPresetId={selectedPresetId} onSelect={handlePresetSelect} />
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isServerReady ? 'Message…' : 'Load a model to start chatting…'}
                  disabled={!isServerReady}
                  rows={1}
                  className="max-h-[200px] min-h-[34px] flex-1 resize-none bg-transparent py-1 text-sm leading-relaxed text-text outline-none placeholder-text-muted disabled:opacity-40"
                />
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!isServerReady || isStreaming}
                    className="p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-30"
                    title={attachmentInputHint()}
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  {messages.length >= 2 && !isStreaming && isServerReady && (
                    <button
                      onClick={() => void handleRegenerate()}
                      className="p-2 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                      title="Regenerate last response"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={isStreaming ? cancelStreaming : () => void handleSend()}
                    disabled={!isServerReady || (!input.trim() && attachments.length === 0 && !isStreaming)}
                    className={cn(
                      'shrink-0 p-2 transition-colors',
                      isStreaming
                        ? 'bg-error text-white hover:bg-error/80'
                        : 'bg-primary text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-20',
                    )}
                  >
                    {isStreaming ? <Square className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isDragActive && (
                <div className="border-t-2 border-dashed border-primary bg-primary/5 px-4 py-3 text-center font-mono text-xs uppercase tracking-wider text-primary">
                  Drop files to attach
                </div>
              )}
            </div>

            {/* Advanced toolbar */}
            {profile === 'advanced' && (
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {input.length}c · ~{estimatedTokens}t
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => setSidePanel(sidePanel === 'params' ? null : 'params')}
                    className={cn(
                      'p-1.5 transition-colors hover:bg-surface-hover hover:text-text',
                      sidePanel === 'params' ? 'bg-primary/10 text-primary' : 'text-text-muted',
                    )}
                    title="Parameters"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSidePanel(sidePanel === 'system-prompt' ? null : 'system-prompt')}
                    className={cn(
                      'p-1.5 transition-colors hover:bg-surface-hover hover:text-text',
                      sidePanel === 'system-prompt' ? 'bg-primary/10 text-primary' : 'text-text-muted',
                    )}
                    title="System Prompt"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setSidePanel(sidePanel === 'logs' ? null : 'logs')}
                    className={cn(
                      'p-1.5 transition-colors hover:bg-surface-hover hover:text-text',
                      sidePanel === 'logs' ? 'bg-primary/10 text-primary' : 'text-text-muted',
                    )}
                    title="Logs"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {profile === 'advanced' && sidePanel === 'params' && (
        <ParameterPanel params={inferenceParams} onChange={setInferenceParams} onClose={() => setSidePanel(null)} />
      )}
      {profile === 'advanced' && sidePanel === 'system-prompt' && (
        <SystemPromptEditor
          value={systemPrompt}
          onChange={setSystemPrompt}
          onClose={() => setSidePanel(null)}
          onTemplateCreated={(template) => setSelectedPresetId(template.id)}
        />
      )}
      {profile === 'advanced' && sidePanel === 'logs' && (
        <LogViewer onClose={() => setSidePanel(null)} />
      )}
    </div>
  )
}

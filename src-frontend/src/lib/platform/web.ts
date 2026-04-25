import type * as T from '../apiTypes'
import { yieldDeltasFromChatDataPayload } from '../chatStream'

const API_BASE = '/api/v1'

interface ErrorResponse {
  error?: string
}

function buildRequestInit(options?: RequestInit): RequestInit {
  const headers = new Headers(options?.headers)

  if (options?.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return {
    ...options,
    headers,
  }
}

async function getErrorMessage(res: Response): Promise<string> {
  const error = (await res.json().catch(() => null)) as ErrorResponse | null
  return error?.error || res.statusText || 'Request failed'
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, buildRequestInit(options))

  if (!res.ok) {
    throw new Error(await getErrorMessage(res))
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

async function requestText(path: string, options?: RequestInit): Promise<string> {
  const res = await fetch(`${API_BASE}${path}`, buildRequestInit(options))

  if (!res.ok) {
    throw new Error(await getErrorMessage(res))
  }

  return res.text()
}

export const getHealth = () => request<{ status: string; version: string }>('/health')

export const getModels = () => request<{ models: T.Model[] }>('/models')
export const scanModels = () => request<{ scanned: number }>('/models/scan', { method: 'POST' })
export const deleteModel = (id: string) =>
  request<{ deleted: boolean }>(`/models/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const importModel = (path: string) =>
  request<T.Model>('/models/import', { method: 'POST', body: JSON.stringify({ path }) })

export const getDownloads = () => request<{ downloads: T.DownloadInfo[] }>('/downloads')
export const startDownload = (url: string, filename: string) =>
  request<{ id: string }>('/downloads/start', {
    method: 'POST',
    body: JSON.stringify({ url, filename }),
  })
export const cancelDownload = (id: string) =>
  request<{ cancelled: boolean }>(`/downloads/${encodeURIComponent(id)}/cancel`, { method: 'POST' })

export const searchHuggingFace = (q: string, limit = 20) =>
  request<{ models: T.HuggingFaceModel[] }>(
    `/huggingface/search?q=${encodeURIComponent(q)}&limit=${limit}`,
  )
export const getHuggingFaceFiles = (repoId: string) =>
  request<T.HuggingFaceFilesResponse>(`/huggingface/model-files/${repoId}`)
export const getModelInspection = (id: string) =>
  request<{ model: T.Model; inspection: T.ModelInspection }>(
    `/models/${encodeURIComponent(id)}/inspect`,
  )
export const getModelAnalytics = (id: string) =>
  request<{ analytics: T.ModelAnalytics }>(`/models/${encodeURIComponent(id)}/analytics`)

export const startServer = (modelId: string, extraArgs: string[] = []) =>
  request<{ status: string }>('/server/start', {
    method: 'POST',
    body: JSON.stringify({ model_id: modelId, extra_args: extraArgs }),
  })
export const stopServer = () => request<{ status: string }>('/server/stop', { method: 'POST' })
export const getServerStatus = () =>
  request<{ status: string; model: string | null }>('/server/status')
export const getServerLogs = () => request<{ logs: T.ServerLogEntry[] }>('/server/logs')
export const getServerFlags = () => request<{ flags: string[] }>('/server/flags')
export const setServerFlags = (flags: string[]) =>
  request<{ flags: string[] }>('/server/flags', { method: 'PUT', body: JSON.stringify({ flags }) })
export const getDependencyStatus = () => request<T.DependencyStatusResponse>('/server/dependencies')
export const getServerMetrics = () => request<Record<string, unknown>>('/server/metrics')
export const detectHardware = () => request<{ hardware: T.HardwareInfo }>('/server/hardware')

export const getConversations = () => request<{ conversations: T.Conversation[] }>('/conversations')
export const createConversation = (data: {
  title?: string
  model_id?: string
  preset_id?: string
  system_prompt?: string
}) => request<T.Conversation>('/conversations', { method: 'POST', body: JSON.stringify(data) })
export const getConversation = (id: string) =>
  request<{ conversation: T.Conversation; messages: T.Message[] }>(
    `/conversations/${encodeURIComponent(id)}`,
  )
export const deleteConversation = (id: string) =>
  request<{ deleted: boolean }>(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const searchConversations = (q: string) =>
  request<{ conversations: T.Conversation[] }>(`/conversations/search?q=${encodeURIComponent(q)}`)
export const exportConversationJson = (id: string) =>
  request<T.ConversationExport>(`/conversations/${encodeURIComponent(id)}/export/json`)
export const exportConversationMarkdown = (id: string) =>
  requestText(`/conversations/${encodeURIComponent(id)}/export/markdown`)
export const forkConversation = (id: string, afterMessageId?: string) =>
  request<T.Conversation>(`/conversations/${encodeURIComponent(id)}/fork`, {
    method: 'POST',
    body: JSON.stringify({ after_message_id: afterMessageId }),
  })
export const updateConversation = (
  id: string,
  data: { title?: string; preset_id?: string; system_prompt?: string },
) =>
  request<T.Conversation>(`/conversations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
export const deleteMessage = (conversationId: string, messageId: string) =>
  request<{ deleted: boolean }>(
    `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
    { method: 'DELETE' },
  )

export const getMessages = (conversationId: string) =>
  request<{ messages: T.Message[] }>(`/conversations/${encodeURIComponent(conversationId)}/messages`)
export const addMessage = (
  conversationId: string,
  data: {
    role: string
    content: string
    attachments?: T.MessageAttachment[]
    tokens_used?: number
    generation_time_ms?: number
  },
) =>
  request<T.Message>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

export async function* streamChat(
  messages: { role: string; content: string }[],
  params?: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(
    `${API_BASE}/chat/completions`,
    buildRequestInit({
      method: 'POST',
      body: JSON.stringify({ messages, stream: true, ...params }),
      signal,
    }),
  )

  if (!res.ok) {
    throw new Error(await getErrorMessage(res))
  }
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue

      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') {
        return
      }
      for (const d of yieldDeltasFromChatDataPayload(data)) {
        yield d
      }
    }
  }
}

export const getPresets = () => request<{ presets: T.Preset[] }>('/presets')
export const createPreset = (data: Omit<T.Preset, 'id' | 'is_builtin'>) =>
  request<T.Preset>('/presets', { method: 'POST', body: JSON.stringify(data) })
export const deletePreset = (id: string) =>
  request<{ deleted: boolean }>(`/presets/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const getConfig = () => request<T.AppConfig>('/config')
export const updateConfig = (data: Partial<T.AppConfig>) =>
  request<T.AppConfig>('/config', { method: 'PUT', body: JSON.stringify(data) })

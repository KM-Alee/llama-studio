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
  const error = await res.json().catch(() => null) as ErrorResponse | null
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

export interface Model {
  id: string
  name: string
  path: string
  size_bytes: number
  quantization: string | null
  architecture: string | null
  parameters: string | null
  context_length: number | null
  added_at: string
  last_used: string | null
}

export interface Conversation {
  id: string
  title: string
  model_id: string | null
  preset_id: string | null
  system_prompt: string | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: string
  content: string
  attachments: MessageAttachment[]
  tokens_used: number | null
  generation_time_ms: number | null
  created_at: string
}

export interface MessageAttachment {
  id: string
  name: string
  mime_type: string
  size_bytes: number
  content: string
}

export interface Preset {
  id: string
  name: string
  description: string | null
  profile: string
  parameters: Record<string, unknown>
  system_prompt: string | null
  is_builtin: boolean
}

export interface DownloadInfo {
  id: string
  url: string
  filename: string
  status: string
  progress: number
  downloaded_bytes: number
  total_bytes: number | null
  error: string | null
}

export interface HuggingFaceModel {
  id: string
  name: string
  author: string | null
  downloads: number
  likes: number
  tags: string[]
  last_modified: string | null
}

export interface HuggingFaceFile {
  filename: string
  size: number
}

export interface HuggingFaceFilesResponse {
  repo_id: string
  files: HuggingFaceFile[]
  gguf_count: number
  total_size_bytes: number
}

export interface ModelMetadataEntry {
  key: string
  value_type: string | null
  value: string
}

export interface ModelInspection {
  binary: string
  command: string
  inspected_at: string
  file_format: string | null
  file_type: string | null
  file_size: string | null
  architecture: string | null
  general_name: string | null
  context_length: number | null
  model_type: string | null
  model_params: string | null
  n_layer: number | null
  n_head: number | null
  n_embd: number | null
  vocab_size: number | null
  metadata: ModelMetadataEntry[]
  raw_output: string[]
  warnings: string[]
}

export interface ModelConversationSummary {
  id: string
  title: string
  updated_at: string
  message_count: number
  assistant_messages: number
  attachment_count: number
  total_tokens: number
  total_generation_time_ms: number
}

export interface ModelAnalytics {
  model_id: string
  conversation_count: number
  message_count: number
  assistant_message_count: number
  attachment_count: number
  total_tokens: number
  avg_tokens_per_response: number | null
  total_generation_time_ms: number
  avg_generation_time_ms: number | null
  tokens_per_second: number | null
  last_used: string | null
  context_length: number | null
  recent_conversations: ModelConversationSummary[]
}

export interface AppConfig {
  llama_cpp_path: string
  models_directory: string
  default_profile: string
  theme: string
  llama_server_port: number
  app_port: number
  context_size: number
  gpu_layers: number
  threads: number
  flash_attention: boolean
  batch_size: number | null
  ubatch_size: number | null
  rope_scaling: string | null
  rope_freq_base: number | null
  rope_freq_scale: number | null
  mmap: boolean | null
  mlock: boolean | null
  cont_batching: boolean | null
}

export interface HardwareInfo {
  cpu_cores: number | null
  total_ram_bytes: number | null
}

export interface ServerLogEntry {
  timestamp: string
  line: string
}

export interface ConversationExport {
  conversation: Conversation
  messages: Message[]
}

export const getHealth = () => request<{ status: string; version: string }>('/health')

export const getModels = () => request<{ models: Model[] }>('/models')
export const scanModels = () => request<{ scanned: number }>('/models/scan', { method: 'POST' })
export const deleteModel = (id: string) => request<{ deleted: boolean }>(`/models/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const importModel = (path: string) =>
  request<Model>('/models/import', { method: 'POST', body: JSON.stringify({ path }) })

export const getDownloads = () => request<{ downloads: DownloadInfo[] }>('/downloads')
export const startDownload = (url: string, filename: string) =>
  request<{ id: string }>('/downloads/start', {
    method: 'POST',
    body: JSON.stringify({ url, filename }),
  })
export const cancelDownload = (id: string) =>
  request<{ cancelled: boolean }>(`/downloads/${encodeURIComponent(id)}/cancel`, { method: 'POST' })

export const searchHuggingFace = (q: string, limit = 20) =>
  request<{ models: HuggingFaceModel[] }>(`/huggingface/search?q=${encodeURIComponent(q)}&limit=${limit}`)
export const getHuggingFaceFiles = (repoId: string) =>
  request<HuggingFaceFilesResponse>(`/huggingface/model-files/${repoId}`)
export const getModelInspection = (id: string) =>
  request<{ model: Model; inspection: ModelInspection }>(`/models/${encodeURIComponent(id)}/inspect`)
export const getModelAnalytics = (id: string) =>
  request<{ analytics: ModelAnalytics }>(`/models/${encodeURIComponent(id)}/analytics`)

export const startServer = (modelId: string, extraArgs: string[] = []) =>
  request<{ status: string }>('/server/start', {
    method: 'POST',
    body: JSON.stringify({ model_id: modelId, extra_args: extraArgs }),
  })
export const stopServer = () => request<{ status: string }>('/server/stop', { method: 'POST' })
export const getServerStatus = () => request<{ status: string; model: string | null }>('/server/status')
export const getServerLogs = () => request<{ logs: ServerLogEntry[] }>('/server/logs')
export const getServerFlags = () => request<{ flags: string[] }>('/server/flags')
export const setServerFlags = (flags: string[]) =>
  request<{ flags: string[] }>('/server/flags', { method: 'PUT', body: JSON.stringify({ flags }) })
export const getServerMetrics = () => request<Record<string, unknown>>('/server/metrics')
export const detectHardware = () => request<{ hardware: HardwareInfo }>('/server/hardware')

export const getConversations = () => request<{ conversations: Conversation[] }>('/conversations')
export const createConversation = (data: {
  title?: string
  model_id?: string
  preset_id?: string
  system_prompt?: string
}) => request<Conversation>('/conversations', { method: 'POST', body: JSON.stringify(data) })
export const getConversation = (id: string) =>
  request<{ conversation: Conversation; messages: Message[] }>(`/conversations/${encodeURIComponent(id)}`)
export const deleteConversation = (id: string) =>
  request<{ deleted: boolean }>(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const searchConversations = (q: string) =>
  request<{ conversations: Conversation[] }>(`/conversations/search?q=${encodeURIComponent(q)}`)
export const exportConversationJson = (id: string) =>
  request<ConversationExport>(`/conversations/${encodeURIComponent(id)}/export/json`)
export const exportConversationMarkdown = (id: string) =>
  requestText(`/conversations/${encodeURIComponent(id)}/export/markdown`)
export const forkConversation = (id: string, afterMessageId?: string) =>
  request<Conversation>(`/conversations/${encodeURIComponent(id)}/fork`, {
    method: 'POST',
    body: JSON.stringify({ after_message_id: afterMessageId }),
  })
export const updateConversation = (id: string, data: { title?: string; preset_id?: string; system_prompt?: string }) =>
  request<Conversation>(`/conversations/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteMessage = (conversationId: string, messageId: string) =>
  request<{ deleted: boolean }>(`/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' })

export const getMessages = (conversationId: string) =>
  request<{ messages: Message[] }>(`/conversations/${encodeURIComponent(conversationId)}/messages`)
export const addMessage = (conversationId: string, data: {
  role: string
  content: string
  attachments?: MessageAttachment[]
  tokens_used?: number
  generation_time_ms?: number
}) =>
  request<Message>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
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
      if (data === '[DONE]') return

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) yield delta
      } catch {
        // Ignore incomplete JSON fragments until the next chunk arrives.
      }
    }
  }
}

export const getPresets = () => request<{ presets: Preset[] }>('/presets')
export const createPreset = (data: Omit<Preset, 'id' | 'is_builtin'>) =>
  request<Preset>('/presets', { method: 'POST', body: JSON.stringify(data) })
export const deletePreset = (id: string) =>
  request<{ deleted: boolean }>(`/presets/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const getConfig = () => request<AppConfig>('/config')
export const updateConfig = (data: Partial<AppConfig>) =>
  request<AppConfig>('/config', { method: 'PUT', body: JSON.stringify(data) })

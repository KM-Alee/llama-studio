const API_BASE = '/api/v1'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error || 'Request failed')
  }

  return res.json()
}

// Health
export const getHealth = () => request<{ status: string; version: string }>('/health')

// Models
export const getModels = () => request<{ models: any[] }>('/models')
export const scanModels = () => request<{ scanned: number }>('/models/scan', { method: 'POST' })
export const deleteModel = (id: string) => request(`/models/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const importModel = (path: string) =>
  request('/models/import', { method: 'POST', body: JSON.stringify({ path }) })

// Downloads
export const getDownloads = () => request<{ downloads: any[] }>('/downloads')
export const startDownload = (url: string, filename: string) =>
  request<{ id: string }>('/downloads/start', {
    method: 'POST',
    body: JSON.stringify({ url, filename }),
  })
export const cancelDownload = (id: string) =>
  request(`/downloads/${encodeURIComponent(id)}/cancel`, { method: 'POST' })

// HuggingFace
export const searchHuggingFace = (q: string, limit = 20) =>
  request<{ models: any[] }>(`/huggingface/search?q=${encodeURIComponent(q)}&limit=${limit}`)

// Server
export const startServer = (modelId: string, extraArgs: string[] = []) =>
  request('/server/start', {
    method: 'POST',
    body: JSON.stringify({ model_id: modelId, extra_args: extraArgs }),
  })
export const stopServer = () => request('/server/stop', { method: 'POST' })
export const getServerStatus = () => request<{ status: string; model: string | null }>('/server/status')
export const getServerLogs = () => request<{ logs: { timestamp: string; line: string }[] }>('/server/logs')
export const getServerFlags = () => request<{ flags: string[] }>('/server/flags')
export const setServerFlags = (flags: string[]) =>
  request<{ flags: string[] }>('/server/flags', { method: 'PUT', body: JSON.stringify({ flags }) })
export const getServerMetrics = () => request<any>('/server/metrics')
export const detectHardware = () => request<{ hardware: any }>('/server/hardware')

// Conversations
export const getConversations = () => request<{ conversations: any[] }>('/conversations')
export const createConversation = (data: {
  title?: string
  model_id?: string
  preset_id?: string
  system_prompt?: string
}) => request<any>('/conversations', { method: 'POST', body: JSON.stringify(data) })
export const getConversation = (id: string) =>
  request<{ conversation: any; messages: any[] }>(`/conversations/${encodeURIComponent(id)}`)
export const deleteConversation = (id: string) =>
  request(`/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' })
export const searchConversations = (q: string) =>
  request<{ conversations: any[] }>(`/conversations/search?q=${encodeURIComponent(q)}`)
export const exportConversationJson = (id: string) =>
  request<any>(`/conversations/${encodeURIComponent(id)}/export/json`)
export const exportConversationMarkdown = async (id: string): Promise<string> => {
  const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(id)}/export/markdown`)
  if (!res.ok) throw new Error('Export failed')
  return res.text()
}
export const forkConversation = (id: string, afterMessageId?: string) =>
  request<any>(`/conversations/${encodeURIComponent(id)}/fork`, {
    method: 'POST',
    body: JSON.stringify({ after_message_id: afterMessageId }),
  })

// Messages
export const getMessages = (conversationId: string) =>
  request<{ messages: any[] }>(`/conversations/${encodeURIComponent(conversationId)}/messages`)
export const addMessage = (conversationId: string, data: {
  role: string
  content: string
  tokens_used?: number
  generation_time_ms?: number
}) =>
  request(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: JSON.stringify(data),
  })

// Chat — SSE streaming that parses OpenAI-format SSE from the backend
export async function* streamChat(
  messages: { role: string; content: string }[],
  params?: Record<string, any>,
): AsyncGenerator<string> {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, stream: true, ...params }),
  })

  if (!res.ok) throw new Error('Chat request failed')
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // Process complete SSE lines from the buffer
    const lines = buffer.split('\n')
    // Keep the last potentially incomplete line in the buffer
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
        // Not valid JSON yet — llama.cpp may split across chunks
      }
    }
  }
}

// Presets
export const getPresets = () => request<{ presets: any[] }>('/presets')
export const createPreset = (data: any) =>
  request('/presets', { method: 'POST', body: JSON.stringify(data) })
export const deletePreset = (id: string) =>
  request(`/presets/${encodeURIComponent(id)}`, { method: 'DELETE' })

// Config
export const getConfig = () => request<any>('/config')
export const updateConfig = (data: any) =>
  request('/config', { method: 'PUT', body: JSON.stringify(data) })

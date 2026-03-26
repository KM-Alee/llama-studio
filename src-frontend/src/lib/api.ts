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

// Server
export const startServer = (modelId: string, extraArgs: string[] = []) =>
  request('/server/start', {
    method: 'POST',
    body: JSON.stringify({ model_id: modelId, extra_args: extraArgs }),
  })
export const stopServer = () => request('/server/stop', { method: 'POST' })
export const getServerStatus = () => request<{ status: string; model: string | null }>('/server/status')

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
): AsyncGenerator<string> {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, stream: true }),
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

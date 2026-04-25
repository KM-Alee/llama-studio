import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type * as T from '../apiTypes'
import { yieldDeltasFromChatDataPayload } from '../chatStream'

/** Top-level Tauri `invoke` argument names use camelCase; nested JSON for serde still uses snake_case. */

function prunedChatParams(
  params?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!params) return undefined
  const o: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) {
      o[k] = v
    }
  }
  return Object.keys(o).length > 0 ? o : undefined
}

export const getHealth = () =>
  invoke<{ status: string; version: string }>('get_health')

export const getModels = () => invoke<{ models: T.Model[] }>('list_models')
export const scanModels = () => invoke<{ scanned: number }>('scan_models')
export const deleteModel = (id: string) => invoke<{ deleted: boolean }>('delete_model', { id })
export const importModel = (path: string) => invoke<T.Model>('import_model', { path })

export const getDownloads = () => invoke<{ downloads: T.DownloadInfo[] }>('list_downloads')
export const startDownload = (url: string, filename: string) =>
  invoke<{ id: string }>('start_download', { url, filename })
export const cancelDownload = (id: string) =>
  invoke<{ cancelled: boolean }>('cancel_download', { id })

export const searchHuggingFace = (q: string, limit = 20) =>
  invoke<{ models: T.HuggingFaceModel[] }>('search_huggingface', { q, limit })
export const getHuggingFaceFiles = (repoId: string) =>
  invoke<T.HuggingFaceFilesResponse>('get_huggingface_files', { repoId })
export const getModelInspection = (id: string) =>
  invoke<{ model: T.Model; inspection: T.ModelInspection }>('inspect_model', { id })
export const getModelAnalytics = (id: string) =>
  invoke<{ analytics: T.ModelAnalytics }>('get_model_analytics', { id })

export const startServer = (modelId: string, extraArgs: string[] = []) =>
  invoke<{ status: string }>('start_server', { modelId, extraArgs })
export const stopServer = () => invoke<{ status: string }>('stop_server')
export const getServerStatus = () =>
  invoke<{ status: string; model: string | null }>('get_server_status')
export const getServerLogs = () => invoke<{ logs: T.ServerLogEntry[] }>('get_server_logs')
export const getServerFlags = () => invoke<{ flags: string[] }>('get_server_flags')
export const setServerFlags = (flags: string[]) =>
  invoke<{ flags: string[] }>('set_server_flags', { flags })
export const getDependencyStatus = () => invoke<T.DependencyStatusResponse>('get_dependency_status')
export const getServerMetrics = () => invoke<Record<string, unknown>>('get_server_metrics')
export const detectHardware = () => invoke<{ hardware: T.HardwareInfo }>('detect_hardware')

export const getConversations = () => invoke<{ conversations: T.Conversation[] }>('list_conversations')
export const createConversation = (data: {
  title?: string
  model_id?: string
  preset_id?: string
  system_prompt?: string
}) => invoke<T.Conversation>('create_conversation', { body: data })
export const getConversation = (id: string) =>
  invoke<{ conversation: T.Conversation; messages: T.Message[] }>('get_conversation', { id })
export const deleteConversation = (id: string) =>
  invoke<{ deleted: boolean }>('delete_conversation', { id })
export const searchConversations = (q: string) =>
  invoke<{ conversations: T.Conversation[] }>('search_conversations', { q })
export const exportConversationJson = (id: string) =>
  invoke<T.ConversationExport>('export_conversation_json', { id })
export const exportConversationMarkdown = (id: string) =>
  invoke<string>('export_conversation_markdown', { id })
export const forkConversation = (id: string, afterMessageId?: string) =>
  invoke<T.Conversation>('fork_conversation', {
    id,
    afterMessageId: afterMessageId ?? null,
  })
export const updateConversation = (
  id: string,
  data: { title?: string; preset_id?: string; system_prompt?: string },
) => invoke<T.Conversation>('update_conversation', { id, body: data })
export const deleteMessage = (conversationId: string, messageId: string) =>
  invoke<{ deleted: boolean }>('delete_message', {
    conversationId,
    messageId,
  })

export const getMessages = (conversationId: string) =>
  invoke<{ messages: T.Message[] }>('get_messages', { id: conversationId })
export const addMessage = (
  conversationId: string,
  data: {
    role: string
    content: string
    attachments?: T.MessageAttachment[]
    tokens_used?: number
    generation_time_ms?: number
  },
) => invoke<T.Message>('add_message', { id: conversationId, body: data })

type ChunkPayload = { request_id: string; data: string }
type ErrorPayload = { request_id: string; message: string }
type DonePayload = { request_id: string }

export async function* streamChat(
  messages: { role: string; content: string }[],
  params?: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const extra = prunedChatParams(params) ?? {}
  const req: Record<string, unknown> = {
    messages,
    stream: true,
    ...extra,
  }

  const requestId: string = await invoke('start_chat_stream', { req })

  const onAbort = () => {
    void invoke('cancel_chat_stream', { requestId })
  }
  if (signal) {
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
  }

  type StreamItem =
    | { t: 'chunk'; data: string }
    | { t: 'err'; message: string }
    | { t: 'done' }
  const queue: StreamItem[] = []
  const waiters: Array<() => void> = []
  const notify = () => {
    const w = waiters.shift()
    w?.()
  }
  const push = (it: StreamItem) => {
    queue.push(it)
    notify()
  }
  const waitForItem = () =>
    new Promise<void>((r) => {
      waiters.push(r)
    })

  const u1 = await listen<ChunkPayload>('chat://chunk', (e) => {
    if (e.payload.request_id !== requestId) return
    push({ t: 'chunk', data: e.payload.data })
  })
  const u2 = await listen<ErrorPayload>('chat://error', (e) => {
    if (e.payload.request_id !== requestId) return
    push({ t: 'err', message: e.payload.message })
  })
  const u3 = await listen<DonePayload>('chat://done', (e) => {
    if (e.payload.request_id !== requestId) return
    push({ t: 'done' })
  })

  const cleanup = () => {
    u1()
    u2()
    u3()
  }

  try {
    for (;;) {
      while (queue.length === 0) {
        await waitForItem()
      }
      const item = queue.shift()!
      if (item.t === 'done') {
        return
      }
      if (item.t === 'err') {
        throw new Error(item.message || 'Chat stream error')
      }
      if (item.data === '[DONE]') {
        return
      }
      for (const d of yieldDeltasFromChatDataPayload(item.data)) {
        yield d
      }
    }
  } finally {
    cleanup()
    if (signal) {
      signal.removeEventListener('abort', onAbort)
    }
  }
}

export const getPresets = () => invoke<{ presets: T.Preset[] }>('get_presets')
export const createPreset = (data: Omit<T.Preset, 'id' | 'is_builtin'>) =>
  invoke<T.Preset>('create_preset', { body: { ...data } })
export const deletePreset = (id: string) =>
  invoke<{ deleted: boolean }>('delete_preset', { id })

export const getConfig = () => invoke<T.AppConfig>('get_config')
export const updateConfig = (data: Partial<T.AppConfig>) =>
  invoke<T.AppConfig>('update_config', { body: data })

export const getUiPreferences = () => invoke<T.UiPreferences>('get_ui_preferences')

function prunedUiPrefsArgs(appPrefs?: unknown, customTemplates?: unknown) {
  const p: Record<string, unknown> = {}
  if (appPrefs !== undefined) p.appPrefs = appPrefs
  if (customTemplates !== undefined) p.customTemplates = customTemplates
  return p
}

export const setUiPreferences = (appPrefs?: unknown, customTemplates?: unknown) =>
  invoke<T.UiPreferences>('set_ui_preferences', prunedUiPrefsArgs(appPrefs, customTemplates))

export const mergeBrowserUiMigration = (appPrefs?: unknown, customTemplates?: unknown) =>
  invoke<T.UiPreferences>(
    'merge_browser_ui_migration',
    prunedUiPrefsArgs(appPrefs, customTemplates),
  )

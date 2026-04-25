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

/**
 * Persisted application settings (SQLite). The legacy `app_port` field is gone: config
 * updates that still send `app_port` are accepted and ignored server-side.
 */
export interface AppConfig {
  llama_cpp_path: string
  models_directory: string
  default_profile: string
  theme: string
  /** Loopback port for the managed llama-server subprocess only (not the old desktop SPA port). */
  llama_server_port: number
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

export interface RuntimeDependencyStatus {
  key: string
  label: string
  required: boolean
  installed: boolean
  resolved_path: string | null
  install_url: string
  help_text: string
}

export interface DependencyStatusResponse {
  platform: string
  backend_bundled: boolean
  dependencies: RuntimeDependencyStatus[]
}

export interface ConversationExport {
  conversation: Conversation
  messages: Message[]
}

export interface UiPreferences {
  app_prefs: Record<string, unknown>
  custom_templates: Preset[] | null
}

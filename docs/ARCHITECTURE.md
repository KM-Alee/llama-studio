# AI Studio — Architecture Document

## Vision

AI Studio is a premium local-first web UI for llama.cpp that makes running LLMs effortless for everyone — from casual users to power users. It wraps llama.cpp's raw speed with a beautiful, responsive interface served on localhost, with Tauri desktop packaging planned for the future.

---

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React SPA)                    │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐  │
│  │  Chat View   │ │ Model Mgmt   │ │  Settings/Config │  │
│  │  (Normal +   │ │ (Download,   │ │  (Normal &       │  │
│  │   Advanced)  │ │  Select,     │ │   Advanced       │  │
│  │             │ │  Profiles)   │ │   Profiles)      │  │
│  └──────┬──────┘ └──────┬───────┘ └────────┬─────────┘  │
│         │               │                   │            │
│         └───────────────┼───────────────────┘            │
│                         │ HTTP/WS/SSE                    │
└─────────────────────────┼────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────┐
│              Rust Backend (Axum)                          │
│  ┌──────────────┐ ┌────┴─────────┐ ┌──────────────────┐ │
│  │  API Router   │ │  WebSocket   │ │  Static File     │ │
│  │  /api/v1/*   │ │  Handler     │ │  Server (SPA)    │ │
│  └──────┬───────┘ └──────┬───────┘ └──────────────────┘ │
│         │                │                               │
│  ┌──────┴────────────────┴──────────────────────────┐    │
│  │              Core Services Layer                  │    │
│  │  ┌────────────┐ ┌───────────┐ ┌───────────────┐  │    │
│  │  │ LlamaCpp   │ │ Model     │ │ Session       │  │    │
│  │  │ Process    │ │ Registry  │ │ Manager       │  │    │
│  │  │ Manager    │ │           │ │               │  │    │
│  │  └─────┬──────┘ └─────┬─────┘ └───────┬───────┘  │    │
│  │        │              │               │           │    │
│  │  ┌─────┴──────┐ ┌─────┴─────┐ ┌──────┴────────┐  │    │
│  │  │ Config     │ │ Preset    │ │ Chat History  │  │    │
│  │  │ Store      │ │ Manager   │ │ Store         │  │    │
│  │  └────────────┘ └───────────┘ └───────────────┘  │    │
│  └───────────────────────────────────────────────────┘    │
│                         │                                │
└─────────────────────────┼────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────┐
│              llama.cpp (Subprocess / HTTP)                │
│  ┌──────────────────────┴───────────────────────────┐    │
│  │           llama-server / llama-cli                │    │
│  │  • Model loading    • Token generation           │    │
│  │  • Context mgmt     • Embedding generation       │    │
│  │  • Grammar support  • Speculative decoding       │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | React 19+ + TypeScript | Mature ecosystem, massive component library availability |
| **Bundler** | Vite | Sub-second HMR, optimized builds |
| **Styling** | Tailwind CSS 4 + shadcn/ui | Utility-first, beautiful defaults, accessible components |
| **State** | Zustand + TanStack Query | Lightweight, performant, server state sync |
| **Backend** | Rust + Axum | Memory safety, extreme performance, async-first |
| **Serialization** | serde + JSON | Standard interop, streaming support |
| **Storage** | SQLite (via rusqlite) | Zero-config, embedded, portable |
| **Process Mgmt** | tokio::process | Async subprocess control for llama.cpp |
| **Desktop** | Tauri (future) | Rust-native, smallest binary size |

---

## User Profiles

### Normal Mode
- **One-click model loading** — pick a model, click "Start Chat"
- **Clean chat interface** — message bubbles, markdown rendering, code highlighting
- **Model browser** — search/download models from HuggingFace with progress bars
- **Conversation management** — history, search, favorites, export
- **Preset system** — "Creative Writing", "Code Assistant", "Q&A", etc.
- **Dark/Light theme** — auto-detect system preference
- **Resource monitor** — simple RAM/VRAM usage indicator

### Advanced Mode (extends Normal)
- **Full parameter control** — temperature, top_p, top_k, min_p, repeat_penalty, mirostat, etc.
- **System prompt editor** — with templates and variables
- **Grammar/GBNF editor** — constrained output formatting
- **Batch/parallel inference** — multiple completions at once
- **Token inspector** — see tokenization, probabilities, logits
- **Performance dashboard** — tokens/sec, context usage, memory mapping
- **API playground** — raw HTTP request builder against llama.cpp
- **Multi-model management** — run multiple models, A/B comparison
- **Custom llama.cpp flags** — full CLI flag control
- **Context window visualization** — see how context is being used
- **Log viewer** — real-time llama.cpp stdout/stderr streaming
- **Speculative decoding config** — draft model setup
- **Embedding mode** — generate and inspect embeddings

---

## API Design

### REST Endpoints (Axum)

```
GET    /api/v1/health                    — Server health check
GET    /api/v1/system/info               — System info (RAM, VRAM, CPU)

POST   /api/v1/models/scan               — Scan directories for models
GET    /api/v1/models                     — List available models
GET    /api/v1/models/:id                 — Model details
POST   /api/v1/models/download            — Download from HuggingFace
DELETE /api/v1/models/:id                 — Remove model

POST   /api/v1/server/start              — Start llama.cpp server
POST   /api/v1/server/stop               — Stop llama.cpp server
GET    /api/v1/server/status             — Server process status

POST   /api/v1/chat/completions          — Chat completion (proxied to llama.cpp)
POST   /api/v1/completions               — Text completion
POST   /api/v1/embeddings                — Generate embeddings
POST   /api/v1/tokenize                  — Tokenize text

GET    /api/v1/conversations             — List conversations
POST   /api/v1/conversations             — Create conversation
GET    /api/v1/conversations/:id         — Get conversation
PUT    /api/v1/conversations/:id         — Update conversation
DELETE /api/v1/conversations/:id         — Delete conversation

GET    /api/v1/presets                   — List parameter presets
POST   /api/v1/presets                   — Create preset
PUT    /api/v1/presets/:id               — Update preset
DELETE /api/v1/presets/:id               — Delete preset

GET    /api/v1/config                    — Get app configuration
PUT    /api/v1/config                    — Update app configuration
```

### WebSocket

```
WS /api/v1/ws/chat                       — Streaming chat (SSE-over-WS)
WS /api/v1/ws/logs                       — Real-time llama.cpp log streaming
WS /api/v1/ws/metrics                    — Live performance metrics
```

---

## Data Models

### Core Entities

```
Model {
  id: UUID
  name: String
  path: FilePath
  format: GGUF
  size_bytes: u64
  quantization: String       // Q4_K_M, Q5_K_S, etc.
  parameters: u64            // 7B, 13B, 70B
  architecture: String       // llama, mistral, phi, etc.
  context_length: u32
  added_at: DateTime
  last_used: DateTime
  metadata: JSON             // GGUF metadata extracted
}

Conversation {
  id: UUID
  title: String
  model_id: UUID
  created_at: DateTime
  updated_at: DateTime
  messages: Vec<Message>
  preset_id: Option<UUID>
  system_prompt: Option<String>
}

Message {
  id: UUID
  conversation_id: UUID
  role: "system" | "user" | "assistant"
  content: String
  tokens_used: u32
  generation_time_ms: u64
  created_at: DateTime
  metadata: JSON             // token probs, etc.
}

Preset {
  id: UUID
  name: String
  description: String
  profile: "normal" | "advanced"
  parameters: InferenceParams
  system_prompt: Option<String>
  is_builtin: bool
}

InferenceParams {
  temperature: f32
  top_p: f32
  top_k: i32
  min_p: f32
  repeat_penalty: f32
  repeat_last_n: i32
  seed: i64
  n_predict: i32
  stop: Vec<String>
  grammar: Option<String>
  mirostat: u8              // 0, 1, 2
  mirostat_tau: f32
  mirostat_eta: f32
  presence_penalty: f32
  frequency_penalty: f32
}

AppConfig {
  llama_cpp_path: FilePath
  models_directory: FilePath
  default_profile: "normal" | "advanced"
  theme: "light" | "dark" | "system"
  server_port: u16           // llama.cpp server port
  app_port: u16              // AI Studio port
  gpu_layers: i32            // -1 = auto
  context_size: u32
  threads: u32
  flash_attention: bool
}
```

---

## Key Design Decisions

1. **Proxy Architecture** — AI Studio backend proxies requests to llama.cpp's HTTP server rather than linking llama.cpp as a library. This keeps the codebase clean, allows independent llama.cpp updates, and makes the future Tauri transition simple.

2. **Process Management** — The Rust backend manages llama.cpp as a child process with full lifecycle control (start/stop/restart/health-check). This gives users one-click model switching.

3. **Streaming First** — All LLM responses use Server-Sent Events for streaming. The backend proxies llama.cpp's SSE stream directly to the frontend for minimum latency.

4. **Profile System** — Normal/Advanced modes share the same underlying components but surface different UI controls. Switching profiles is instant (no reload).

5. **SQLite for Everything** — Conversations, presets, configs all in one SQLite database. Portable, fast, zero-configuration.

6. **Static SPA Serving** — In production, the Rust binary embeds and serves the React build output. One binary = entire application.

7. **Tauri-Ready** — The architecture deliberately separates backend logic from the HTTP server layer so that migrating to Tauri's IPC is a clean swap.

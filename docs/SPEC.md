# AI Studio — Component Specification

## 1. Backend Components (Rust/Axum)

### 1.1 Application Core (`src-backend/src/main.rs`)
- Initialize tracing/logging
- Load configuration from file or defaults
- Initialize SQLite database with migrations
- Start Axum HTTP server
- Serve SPA static files
- Graceful shutdown handler

### 1.2 LlamaCpp Process Manager (`src-backend/src/services/llama_process.rs`)
**Purpose**: Manages llama.cpp server as a child process

| Feature | Description |
|---------|-------------|
| Start | Launch llama-server with configured parameters |
| Stop | Graceful SIGTERM then SIGKILL after timeout |
| Restart | Stop + Start with new parameters |
| Health Check | Poll `/health` endpoint of llama.cpp |
| Log Capture | Capture stdout/stderr, forward to WebSocket |
| Status | Running/Stopped/Starting/Error states |
| Auto-restart | Optional restart on crash |

**State Machine**:
```
Stopped → Starting → Running → Stopping → Stopped
                 ↓                    ↓
               Error              Error
```

### 1.3 Model Registry (`src-backend/src/services/model_registry.rs`)
**Purpose**: Discover, catalog, and manage GGUF model files

| Feature | Description |
|---------|-------------|
| Scan | Recursively scan configured directories for .gguf files |
| Parse Metadata | Extract GGUF header info (architecture, params, quant) |
| Download | Download models from HuggingFace with progress tracking |
| Delete | Remove model files with confirmation |
| Search | Search local models by name, size, architecture |
| Validate | Verify file integrity before loading |

### 1.4 Session Manager (`src-backend/src/services/session_manager.rs`)
**Purpose**: Manage chat sessions and message history

| Feature | Description |
|---------|-------------|
| Create Session | New conversation with optional preset |
| Message Store | Append messages with metadata |
| History | Paginated conversation list |
| Search | Full-text search across messages |
| Export | Export conversations as JSON/Markdown |
| Fork | Branch conversation from any message |

### 1.5 Config Store (`src-backend/src/services/config_store.rs`)
**Purpose**: Persistent application configuration

| Feature | Description |
|---------|-------------|
| Load | Read config from SQLite on startup |
| Update | Validate and persist config changes |
| Defaults | Sensible defaults for all settings |
| Migration | Schema versioning for upgrades |

### 1.6 Preset Manager (`src-backend/src/services/preset_manager.rs`)
**Purpose**: Manage inference parameter presets

| Feature | Description |
|---------|-------------|
| Built-in Presets | Creative Writing, Precise Q&A, Code, Roleplay, etc. |
| Custom Presets | User-created parameter sets |
| Profile Filter | Normal-mode presets vs Advanced-mode presets |
| Import/Export | Share presets as JSON files |

### 1.7 API Router (`src-backend/src/routes/`)
**Purpose**: HTTP endpoint handlers organized by domain

| Module | Endpoints |
|--------|-----------|
| `health.rs` | GET /health, GET /system/info |
| `models.rs` | CRUD for models, scan, download |
| `server.rs` | Start/stop/status for llama.cpp |
| `chat.rs` | Chat completions with SSE streaming |
| `conversations.rs` | Conversation CRUD |
| `presets.rs` | Preset CRUD |
| `config.rs` | App configuration |

### 1.8 Database Layer (`src-backend/src/db/`)
**Purpose**: SQLite schema and queries

| Module | Tables |
|--------|--------|
| `migrations.rs` | Schema versioning |
| `models.rs` | models table queries |
| `conversations.rs` | conversations + messages tables |
| `presets.rs` | presets table |
| `config.rs` | config key-value store |

---

## 2. Frontend Components (React/TypeScript)

### 2.1 App Shell (`src-frontend/src/App.tsx`)
- Profile switcher (Normal ↔ Advanced)
- Sidebar navigation
- Theme provider
- Global error boundary
- WebSocket connection manager

### 2.2 Layout Components

| Component | Description |
|-----------|-------------|
| `Sidebar` | Conversation list, model selector, new chat button |
| `TopBar` | Profile toggle, settings gear, status indicators |
| `MainContent` | Chat area or settings panel |
| `StatusBar` | Connection status, model info, tokens/sec |

### 2.3 Chat Components

| Component | Description |
|-----------|-------------|
| `ChatView` | Main chat container, message list, input |
| `MessageBubble` | Rendered message with markdown, code blocks |
| `ChatInput` | Auto-resizing textarea with send button |
| `StreamingIndicator` | Animated typing indicator during generation |
| `TokenCounter` | Live token count for input |
| `StopButton` | Abort generation |
| `RegenerateButton` | Re-generate last response |
| `MessageActions` | Copy, edit, delete, fork from here |

### 2.4 Model Management Components

| Component | Description |
|-----------|-------------|
| `ModelBrowser` | Grid/list view of local models |
| `ModelCard` | Model info card with quick-load button |
| `ModelDownloader` | HuggingFace search + download with progress |
| `ModelDetails` | Full metadata view, GGUF info |

### 2.5 Settings Components

| Component | Description |
|-----------|-------------|
| `SettingsPanel` | Tabbed settings view |
| `GeneralSettings` | Theme, paths, default profile |
| `ModelSettings` | Model directory, GPU layers, threads |
| `ServerSettings` | Ports, auto-start, llama.cpp binary path |

### 2.6 Advanced Mode Components

| Component | Description |
|-----------|-------------|
| `ParameterPanel` | Full inference parameter controls |
| `SystemPromptEditor` | Rich editor with template variables |
| `GrammarEditor` | GBNF grammar editor with syntax highlighting |
| `TokenInspector` | Visualization of token probabilities |
| `PerformanceDashboard` | Charts for tokens/sec, memory, context |
| `LogViewer` | Real-time llama.cpp log stream |
| `APIPlayground` | Raw request builder and response viewer |
| `ContextVisualizer` | Context window usage visualization |

### 2.7 Shared Components

| Component | Description |
|-----------|-------------|
| `CodeBlock` | Syntax-highlighted code with copy button |
| `MarkdownRenderer` | Full GFM rendering with LaTeX support |
| `SearchBar` | Fuzzy search component |
| `ProgressBar` | Download/loading progress |
| `Toaster` | Toast notifications |
| `ConfirmDialog` | Confirmation modals |
| `Kbd` | Keyboard shortcut display |
| `EmptyState` | Placeholder for empty views |

---

## 3. State Management

### Zustand Stores

| Store | Responsibility |
|-------|---------------|
| `useAppStore` | Profile mode, theme, sidebar state |
| `useChatStore` | Active conversation, streaming state |
| `useModelStore` | Loaded model, available models |
| `useServerStore` | llama.cpp server status |
| `useConfigStore` | App configuration |

### TanStack Query Keys

| Key | Data |
|-----|------|
| `['conversations']` | Conversation list |
| `['conversation', id]` | Single conversation with messages |
| `['models']` | Available models |
| `['presets']` | Parameter presets |
| `['server-status']` | Server status (polling) |
| `['system-info']` | System resource info |

---

## 4. Comfort Features

### For Everyone (Normal + Advanced)
1. **Keyboard Shortcuts** — Ctrl+N new chat, Ctrl+/ search, Ctrl+Shift+P command palette
2. **Drag & Drop** — Drop .gguf files to add models
3. **Auto-title** — Automatically generate conversation titles
4. **Quick Model Switch** — Switch models mid-conversation
5. **Export Chat** — Copy as Markdown, save as JSON/PDF
6. **Search Everything** — Fuzzy search across conversations
7. **Responsive Design** — Works on tablets and phones
8. **Smooth Animations** — Framer Motion transitions
9. **Notification System** — Download complete, server ready, errors
10. **Auto-save** — Conversations saved in real-time
11. **Model Recommendations** — Suggest models based on system capabilities
12. **One-Click Setup** — Auto-detect llama.cpp installation

### Advanced Extras
13. **Request Inspector** — See raw HTTP going to llama.cpp
14. **Benchmark Mode** — Run standardized perf tests on models
15. **Config Import/Export** — Share entire setups
16. **Multi-turn Templates** — Complex prompt chains
17. **Diff View** — Compare regenerated responses
18. **Session Forking** — Branch from any point in conversation

---

## 5. Security Considerations

- **Local-only by default** — Binds to 127.0.0.1, not 0.0.0.0
- **No telemetry** — Zero data leaves the machine
- **Input validation** — All API inputs validated with serde
- **Path traversal protection** — Model paths sanitized
- **Process isolation** — llama.cpp runs as separate process
- **CORS restricted** — Only allow same-origin requests
- **No eval/exec** — No dynamic code execution

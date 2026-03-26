# AI Studio — Build Phases

## Phase 0: Foundation (Current)
**Goal**: Project scaffold, tooling, dev workflow

- [x] Architecture document
- [x] Component specification
- [x] Phase plan
- [x] Rust backend scaffold (Axum + project structure)
- [x] React frontend scaffold (Vite + TypeScript + Tailwind)
- [x] Agent/copilot customization files
- [x] Dev environment setup (Makefile, scripts)
- [x] CI/lint configuration

---

## Phase 1: Core Backend
**Goal**: Rust backend that can manage llama.cpp

### Tasks
- [x] SQLite database setup with migrations
- [x] Configuration store (load/save/defaults)
- [x] llama.cpp process manager (start/stop/restart/health)
- [x] Model directory scanner (find .gguf files, parse metadata)
- [x] Basic REST API routes (health, models, server control)
- [x] Integration test: start llama.cpp, verify health

### Deliverable
Backend binary that starts llama.cpp with a model, monitors its health, and exposes REST endpoints.

---

## Phase 2: Chat Pipeline
**Goal**: End-to-end chat with streaming

### Tasks
- [x] SSE streaming proxy (backend → llama.cpp → browser)
- [x] Conversation CRUD in SQLite
- [x] Message storage with metadata
- [x] WebSocket setup for bidirectional comms
- [x] Basic error handling and retry logic
- [x] Chat completion API endpoint

### Deliverable
Can send a message and receive streaming tokens back through the full stack.

---

## Phase 3: Normal Mode UI
**Goal**: Beautiful chat UI for everyday users

### Tasks
- [x] App shell layout (sidebar + topbar + content)
- [x] Conversation list with search
- [x] Chat view with message bubbles
- [x] Markdown rendering with code highlighting
- [x] Chat input with auto-resize and token count
- [x] Model selector dropdown
- [x] New chat / delete chat flows
- [x] Preset selector (Creative, Precise, Code, etc.)
- [x] Theme system (dark/light/system)
- [x] Loading states and animations
- [x] Toast notifications
- [x] Keyboard shortcuts

### Deliverable
A fully usable chat interface in Normal mode that feels polished and professional.

---

## Phase 4: Model Management
**Goal**: Easy model discovery and management

### Tasks
- [ ] Model browser page (grid + list views)
- [ ] Model detail panel (metadata, size, architecture)
- [ ] Drag-and-drop model import
- [ ] HuggingFace model search integration
- [ ] Download manager with progress tracking
- [ ] Model deletion with confirmation
- [ ] One-click model loading
- [ ] VRAM/RAM requirement estimates

### Deliverable
Users can browse, download, import, and manage models entirely through the UI.

---

## Phase 5: Advanced Mode
**Goal**: Power user features

### Tasks
- [ ] Profile switcher UI (Normal ↔ Advanced toggle)
- [ ] Full parameter panel (temperature, top_p, top_k, etc.)
- [ ] System prompt editor with templates
- [ ] Grammar/GBNF editor with syntax highlighting
- [ ] Token probability inspector
- [ ] Performance metrics dashboard (charts)
- [ ] Real-time log viewer (WebSocket stream)
- [ ] Context window visualizer
- [ ] API playground
- [ ] Custom llama.cpp CLI flags editor

### Deliverable
Advanced mode with full control over every aspect of model inference.

---

## Phase 6: Comfort Features
**Goal**: Polish that makes the difference

### Tasks
- [ ] Auto-title generation for conversations
- [ ] Command palette (Ctrl+Shift+P)
- [ ] Conversation search (full-text)
- [ ] Export (Markdown, JSON, PDF)
- [ ] Conversation forking
- [ ] Response regeneration with diff view
- [ ] Quick model switch mid-conversation
- [ ] Responsive mobile layout
- [ ] Onboarding wizard (first-run setup)
- [ ] Auto-detect llama.cpp installation
- [ ] Model recommendations based on hardware

### Deliverable
A highly polished, _delightful_ experience with all comfort features.

---

## Phase 7: Production Hardening
**Goal**: Stable, reliable, performant

### Tasks
- [ ] Comprehensive error handling
- [ ] Request validation and sanitization
- [ ] Rate limiting for safety
- [ ] Graceful shutdown / cleanup
- [ ] Database backup/restore
- [ ] Performance optimization (lazy loading, virtualized lists)
- [ ] Accessibility audit (ARIA, keyboard nav)
- [ ] Cross-browser testing
- [ ] Bundle size optimization
- [ ] Static binary embedding (include SPA in Rust binary)

### Deliverable
Production-quality application ready for public release.

---

## Phase 8: Tauri Desktop App (Future)

### Deliverable
Standalone desktop application with system integration.

---

## Parallel Tracks (Throughout)

### Testing
- Unit tests: Rust services, React components
- Integration tests: API endpoints
- E2E tests: Playwright for full flows

### Documentation
- README with getting started
- API documentation
- Contributing guide
- User guide

# AI Studio

A beautiful, fast, local-first web UI for [llama.cpp](https://github.com/ggerganov/llama.cpp). Built with Rust and React for maximum performance and usability.

## Features

- **Two Profiles**: Normal mode for casual users, Advanced mode for power users
- **Beautiful Chat UI**: Markdown rendering, code highlighting, streaming responses
- **Model Management**: Browse, scan, and load GGUF models with one click
- **Preset System**: Built-in presets for creative writing, coding, Q&A, and more
- **Full Parameter Control** (Advanced): Temperature, top_p, top_k, grammar, and every llama.cpp flag
- **Performance Dashboard** (Advanced): Real-time tokens/sec, memory usage, context visualization
- **Local & Private**: Everything runs on your machine, zero telemetry

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Rust + Axum |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS 4 |
| State | Zustand + TanStack Query |
| Database | SQLite (embedded) |
| LLM Engine | llama.cpp (managed as subprocess) |

## Prerequisites

- **Rust** 1.70+ (`rustup` recommended)
- **Node.js** 20+ with `pnpm`
- **llama.cpp** — [build from source](https://github.com/ggerganov/llama.cpp#build) or download a release (tested with b8530, Vulkan)
- A GGUF model file

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url> ai-studio
cd ai-studio

# 2. Install frontend dependencies
cd src-frontend && pnpm install && cd ..

# 3. Start development servers
make dev

# Frontend: http://localhost:5173
# Backend:  http://localhost:3000
```

## Development

```bash
# Start both servers (backend + frontend)
make dev

# Or start individually
make dev-backend    # Rust backend on :3000
make dev-frontend   # Vite dev server on :5173

# Type checking
make check

# Build for production
make build
```

## Project Structure

```
ai-studio/
├── src-backend/          # Rust Axum backend
│   └── src/
│       ├── main.rs       # Server entry
│       ├── state.rs      # App state
│       ├── routes/       # HTTP handlers
│       ├── services/     # Business logic
│       └── db/           # SQLite layer
├── src-frontend/         # React SPA
│   └── src/
│       ├── components/   # UI components
│       ├── pages/        # Route pages
│       ├── stores/       # Zustand state
│       └── lib/          # API client + utils
├── docs/                 # Architecture & specs
│   ├── ARCHITECTURE.md
│   ├── SPEC.md
│   └── PHASES.md
└── .github/              # Copilot customization
    ├── copilot-instructions.md
    ├── AGENTS.md
    └── skills/
```

## Configuration

On first run, configure via Settings page or edit the SQLite database:

| Setting | Default | Description |
|---------|---------|-------------|
| `llama_cpp_path` | `""` (uses PATH) | Path to llama-server binary |
| `models_directory` | `~/models` | Directory to scan for .gguf files |
| `llama_server_port` | `8080` | Port for llama.cpp server |
| `context_size` | `4096` | Default context window |
| `gpu_layers` | `-1` (all) | Layers to offload to GPU |

## License

MIT

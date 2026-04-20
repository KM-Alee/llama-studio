# LlamaStudio Spec

## Product Goal

LlamaStudio is a local-first desktop app for running llama.cpp models with a polished chat workflow, strong defaults, configurable inference controls, and local model management.

## Core Requirements

- The backend must only bind to localhost.
- The desktop shell must launch the backend and open it in a native window.
- First-run experience must be understandable for non-technical users.
- Chat history, presets, and configuration must persist locally.
- The app must work without cloud services.

## First-Run Requirements

- Light theme enabled by default
- Dependency status visible in Settings
- Clear install links for missing `llama-server`
- Safe defaults for inference parameters
- No invalid `max_tokens = -1` behavior

## Runtime Defaults

- Vite dev server: `6767`
- LlamaStudio backend: `6868`
- llama.cpp server: `6970`

## Backend Responsibilities

- Serve the API under `/api/v1`
- Manage persisted config, conversations, presets, and downloads
- Start, stop, and monitor the `llama-server` subprocess
- Detect required runtime dependencies and expose their status to the frontend
- Serve embedded frontend assets in release builds

## Frontend Responsibilities

- Provide chat, models, analytics, and settings pages
- Render Markdown reliably, including lists, tables, code, and math
- Keep API access centralized in `src-frontend/src/lib/api.ts`
- Support both browser development and the Tauri desktop shell

## Desktop Requirements

- Tauri must start the shared Rust backend runtime during startup
- Closing the desktop window must stop backend-managed subprocesses
- Release packaging must target Windows and major Linux package formats

## Validation Requirements

Before a release or push-ready state, run:

- `cd src-frontend && npm run lint`
- `cd src-frontend && npm test`
- `cd src-frontend && npm run build`
- `cd src-backend && cargo test`

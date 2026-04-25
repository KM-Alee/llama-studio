# LlamaStudio Architecture

## Overview

LlamaStudio is a local-first application composed of three layers:

- A Rust Axum backend in `src-backend`
- A React + Vite frontend in `src-frontend`
- A Tauri desktop shell in `src-frontend/src-tauri`

In development, the frontend runs on Vite and proxies HTTP requests to the standalone Axum backend on port `6868`. In **desktop** mode, the UI is served as **bundled static assets** inside the Tauri webview; the same Rust `AppState` runs **in-process** and the UI talks to it via **Tauri commands** (`invoke`) and **events** (for streaming and background updates), not the browser HTTP API.

## Request Flow

### Browser / standalone backend (dev, `llamastudio-backend` binary)

1. The user interacts with the React UI.
2. The UI calls HTTP endpoints under `/api/v1` (proxied from Vite in dev).
3. The backend loads or stores local state in SQLite and configuration storage.
4. The backend manages the `llama-server` subprocess for inference.
5. Chat streaming uses **SSE** over `POST /api/v1/chat/completions`; server status may use WebSocket `/api/v1/ws`.

### Native desktop (Tauri)

1. The user interacts with the React UI (bundled assets).
2. The UI calls Tauri commands that map to the same `app_core` logic as the HTTP routes.
3. SQLite and config behave the same as the HTTP server path.
4. `llama-server` is still a subprocess managed by the backend crate.
5. Chat streaming uses Tauri events (`chat://chunk`, `chat://done`, `chat://error`) instead of SSE in the webview.

## Backend Design

The backend is organized around:

- `routes/` for API handlers
- `services/` for application logic and process management
- `db/` for SQLite access
- `state.rs` for shared application state
- `app.rs` for shared runtime bootstrap

`app.rs` is the composition point used by both the standalone backend binary and the Tauri shell.

## Frontend Design

The frontend uses React 19, TypeScript, Zustand, TanStack Query, and Tailwind CSS 4.

Key structure:

- `pages/` route-level screens
- `components/` layout, chat, and shared UI primitives
- `stores/` Zustand state stores
- `lib/` API access, utilities, and frontend helpers

API access remains centralized through `src-frontend/src/lib/api.ts`.

## Desktop Shell

The Tauri shell links directly against the backend crate instead of running a separate service binary.

Important behavior:

- Startup builds `AppState` (SQLite, config, download manager, etc.) before opening the main window.
- The webview loads **bundled** `index.html` / assets (`WebviewUrl::App`), not `http://127.0.0.1:6868`.
- Window shutdown stops managed `llama-server` processes.

See [DESKTOP_ARCHITECTURE.md](./DESKTOP_ARCHITECTURE.md) for the canonical desktop IPC and event contract.

## Local Data

- **Web / dev:** Zustand `persist` may use browser `localStorage` for UI preferences.
- **Desktop:** durable UI preferences and related fields are stored in SQLite (`desktop_ui_state`) via Tauri commands; see `get_ui_preferences` / `set_ui_preferences` and bootstrap in the frontend.
- SQLite data lives under the local app data directory in `llamastudio/llamastudio.db`.
- Legacy `ai-studio` data is migrated forward on first launch.

## Ports

- Vite dev server: `6767`
- LlamaStudio backend: `6868`
- llama.cpp server: `6970`

## Release Flow

- Frontend release checks: lint, tests, production build
- Backend release checks: `cargo test`
- Desktop packaging: Tauri bundle builds for Windows and Linux via GitHub Actions

## Non-Goals

- No hosted backend dependency
- No non-local network binding by default
- No intentional divergence in **business rules** between browser and desktop; transport differs (HTTP vs IPC) only.

# LlamaStudio Architecture

## Overview

LlamaStudio is a local-first application composed of three layers:

- A Rust Axum backend in `src-backend`
- A React + Vite frontend in `src-frontend`
- A Tauri desktop shell in `src-frontend/src-tauri`

In development, the frontend runs on Vite and proxies API requests to the backend. In desktop mode, Tauri starts the same backend runtime and opens the local backend URL inside a native webview.

## Request Flow

1. The user interacts with the React UI.
2. The UI calls backend endpoints under `/api/v1`.
3. The backend loads or stores local state in SQLite and configuration storage.
4. The backend manages the `llama-server` subprocess for inference.
5. Streaming responses are returned to the UI through SSE.

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

- Startup initializes the backend before opening the main window.
- The shell points the webview at the local backend URL.
- Window shutdown also stops managed llama.cpp processes.

## Local Data

- App state persists in browser storage under the LlamaStudio key.
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
- No split behavior between browser mode and desktop mode

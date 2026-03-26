# AI Studio — Copilot Instructions

## Project Overview
AI Studio is a local-first web UI for llama.cpp with a Rust (Axum) backend and React (TypeScript + Vite + Tailwind) frontend.

## Architecture
- **Monorepo**: `src-backend/` (Rust) and `src-frontend/` (React) 
- **Backend**: Axum web server on port 3000, proxies to llama.cpp HTTP server
- **Frontend**: React 19 SPA served by Vite in dev, embedded in Rust binary in prod
- **Database**: SQLite via rusqlite (embedded)
- **State**: Zustand stores + TanStack Query for server state

## Key Conventions

### Rust Backend
- Load `.github/skills/ms-rust/SKILL.md` before any Rust code change
- Load `.github/skills/rust-backend/SKILL.md` for AI Studio-specific backend conventions
- Use `AppError` from `src-backend/src/error.rs` for all error handling
- Return `AppResult<T>` from all route handlers
- Use `State(state): State<AppState>` for dependency injection
- All async DB methods wrap sync rusqlite behind `Mutex<Connection>`
- Process management: `LlamaProcessManager` manages llama.cpp as a child process
- Bind to 127.0.0.1 ONLY — never expose to network

### React Frontend
- Load `.github/skills/react-frontend/SKILL.md` before frontend implementation work
- Path alias: `@/` maps to `src/`
- State: Use Zustand stores in `src/stores/` for client state
- API: All backend calls go through `src/lib/api.ts`
- Styling: Tailwind CSS 4 with custom theme tokens (see `index.css`)
- Components: layout/ for shell, chat/ for chat UI, pages/ for routes
- Profile system: `useAppStore().profile` is "normal" or "advanced"
- Always check `profile === 'advanced'` before rendering advanced UI

### Code Style
- Rust: Follow Rust 2024 edition, use `anyhow` for errors, `serde` for serialization
- TypeScript: Strict mode, no `any` in new code, prefer interfaces over types
- Components: Named exports, functional components, no default exports for components
- Avoid `console.log` — use proper toast notifications via react-hot-toast

### File Organization
```
src-backend/
  src/
    main.rs          — Entry point, server setup
    state.rs         — AppState with all services
    error.rs         — Error types
    routes/          — HTTP handlers by domain
    services/        — Business logic
    db/              — Database layer
src-frontend/
  src/
    main.tsx         — React entry, providers
    App.tsx          — Router setup
    components/      — UI components
      layout/        — App shell (Layout, Sidebar, TopBar, StatusBar)
      chat/          — Chat UI (ChatView, MessageBubble)
    pages/           — Route pages
    stores/          — Zustand stores
    lib/             — API client, utilities
```

## Security Rules
- Never expose server to 0.0.0.0
- Validate all path inputs (prevent path traversal)
- Sanitize user input before passing to llama.cpp CLI
- No secrets in code — all config in SQLite or env vars
- CORS restricted to same-origin in production

## Commands
- Backend: `cd src-backend && cargo run` (dev) / `cargo build --release` (prod)
- Frontend: `cd src-frontend && pnpm dev` (dev) / `pnpm build` (prod)
- Both: `make dev` (starts both concurrently)
- Check: `cd src-backend && cargo check` / `cd src-frontend && pnpm tsc --noEmit`

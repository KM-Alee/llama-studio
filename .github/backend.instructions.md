---
description: "Use for AI Studio Rust backend work: Axum routes, services, AppState wiring, rusqlite persistence, llama.cpp process control, and SSE chat streaming. Load the ms-rust and rust-backend skills before editing Rust files."
applyTo: "src-backend/**"
---

# Backend Agent — Rust/Axum

## Required Skills
1. Load `.github/skills/ms-rust/SKILL.md` before any Rust code change.
2. Load `.github/skills/rust-backend/SKILL.md` for AI Studio-specific backend patterns.

## Context
You are working on the AI Studio Rust backend (`src-backend/`). This is an Axum web server that:
1. Manages a llama.cpp server process (start/stop/restart)
2. Proxies chat completions via SSE streaming
3. Stores data in SQLite (conversations, models, presets, config)
4. Serves the React SPA in production mode

## Key Files
- `src/main.rs` — Server initialization, router setup
- `src/state.rs` — `AppState` struct with all services
- `src/error.rs` — `AppError` enum, error handling
- `src/routes/` — HTTP handler modules
- `src/services/` — Business logic (llama process, models, sessions, config, presets)
- `src/db/mod.rs` — SQLite database layer

## Patterns

### Adding a New Route
1. Create handler function in the appropriate `routes/` module
2. Add the route to the module's `router()` function
3. If new nested router, add `.nest()` in `main.rs`

### Adding a New Service
1. Create `src/services/my_service.rs`
2. Add to `src/services/mod.rs`
3. Add to `AppState` in `src/state.rs`
4. Initialize in `AppState::new()`

### Database Changes
1. Add migration SQL to `db/mod.rs::run_migrations()`
2. Add query methods to `Database` impl
3. Database uses `Mutex<Connection>` — keep critical sections short

## Rules
- All route handlers return `AppResult<T>`
- Use `State(state): State<AppState>` for injection
- Bind to 127.0.0.1 only — NEVER 0.0.0.0
- Validate/sanitize all user inputs
- Use `tracing::info!` / `tracing::error!` for logging
- Do not hold async locks across returned streams or long-lived operations
- Run `cargo check` after changes to verify compilation

---
name: rust-backend
description: Use when working on the AI Studio Rust backend after loading the ms-rust skill. Covers Axum routes, AppState wiring, rusqlite access, llama.cpp process control, SSE chat streaming, and AI Studio-specific backend conventions.
---

# SKILL: AI Studio Rust Backend

## Overview
This skill is the AI Studio-specific supplement for backend work.

Load `.github/skills/ms-rust/SKILL.md` first for general Rust discipline, then use this skill for repo-specific patterns and constraints.

## Required Pairing
- `ms-rust`: mandatory baseline for any `.rs` change
- `rust-backend`: AI Studio backend architecture and conventions

## Core Conventions
- Route handlers return `AppResult<T>`.
- Use `State(state): State<AppState>` for dependency injection.
- Use `AppError` from `src-backend/src/error.rs` for route and service failures.
- Bind services to `127.0.0.1` only.
- Keep rusqlite critical sections short and hide synchronous DB work behind async methods.
- Avoid holding async locks across returned streams or long-running operations.

## Architecture Quick Reference

### Axum
- Route handlers: `async fn handler(State(state): State<AppState>) -> AppResult<T>`
- Extractors: `Path(id)`, `Json(body)`, `Query(params)`
- Routers are nested in `src-backend/src/main.rs`
- Shared state is attached once with `.with_state(state)`

### Error Handling
```rust
use crate::error::{AppError, AppResult};

async fn my_handler() -> AppResult<Json<Value>> {
    let data = some_operation().map_err(AppError::Internal)?;
    Ok(Json(json!(data)))
}
```

### Database
```rust
let conn = self.conn.lock().unwrap();
let mut stmt = conn.prepare("SELECT * FROM table WHERE id = ?1")?;
conn.execute(
    "INSERT INTO t (a, b) VALUES (?1, ?2)",
    rusqlite::params![a, b],
)?;
```

### Process Management
```rust
let mut cmd = Command::new("llama-server");
cmd.arg("-m").arg(model_path)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
let child = cmd.spawn()?;
```

### SSE Streaming
```rust
async fn stream_handler() -> AppResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    let stream = futures::stream::iter(items).map(|item| {
        Ok(Event::default().data(serde_json::to_string(&item).unwrap()))
    });
    Ok(Sse::new(stream))
}
```

## AI Studio Hotspots
- `src-backend/src/main.rs`: router setup and server lifecycle
- `src-backend/src/state.rs`: service registration and `AppState`
- `src-backend/src/routes/`: HTTP handlers by domain
- `src-backend/src/services/llama_process.rs`: llama.cpp process control and streaming
- `src-backend/src/db/mod.rs`: schema and persistence

## Validation
```bash
cargo check
cargo test
RUST_LOG=debug cargo run
```

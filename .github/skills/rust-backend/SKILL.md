# SKILL: Rust Backend Development

## Overview
Guidelines for developing the Rust/Axum backend of AI Studio.

## Library Quick Reference

### Axum
- Route handlers: `async fn handler(State(state): State<AppState>) -> AppResult<Json<Value>>`
- Extractors: `Path(id)`, `Json(body)`, `Query(params)`
- Router: `Router::new().route("/path", get(handler).post(handler))`
- Nesting: `Router::new().nest("/prefix", sub_router())`
- State: `.with_state(state)` on the top-level router

### Error Handling
```rust
use crate::error::{AppError, AppResult};

// Return AppResult from all handlers
async fn my_handler() -> AppResult<Json<Value>> {
    let data = some_operation().map_err(|e| AppError::Internal(e.into()))?;
    Ok(Json(json!(data)))
}
```

### Database (rusqlite)
```rust
// All DB methods are async but internally lock a Mutex<Connection>
let conn = self.conn.lock().unwrap();
let mut stmt = conn.prepare("SELECT * FROM table WHERE id = ?1")?;
// Use params![] macro for parameters
conn.execute("INSERT INTO t (a, b) VALUES (?1, ?2)", rusqlite::params![a, b])?;
```

### Process Management
```rust
use tokio::process::Command;
let mut cmd = Command::new("llama-server");
cmd.arg("-m").arg(model_path)
   .stdout(Stdio::piped())
   .stderr(Stdio::piped());
let child = cmd.spawn()?;
```

### SSE Streaming
```rust
use axum::response::sse::{Event, Sse};
use futures::stream::Stream;

async fn stream_handler() -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let stream = futures::stream::iter(items).map(|item| {
        Ok(Event::default().data(serde_json::to_string(&item).unwrap()))
    });
    Sse::new(stream)
}
```

## Testing
```bash
# Check compilation
cargo check

# Run tests
cargo test

# Run with logging
RUST_LOG=debug cargo run
```

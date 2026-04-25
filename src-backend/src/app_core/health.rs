use serde_json::{Value, json};

/// Health payload for desktop commands and HTTP `/api/v1/health`.
pub fn health_json() -> Value {
    json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "name": "LlamaStudio"
    })
}

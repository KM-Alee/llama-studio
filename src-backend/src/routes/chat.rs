use axum::{
    Router,
    extract::State,
    response::sse::{Event, Sse},
    routing::post,
    Json,
};
use futures::stream::Stream;
use serde::Deserialize;
use serde_json::Value;
use std::convert::Infallible;

use crate::error::AppResult;
use crate::state::AppState;
use crate::services::llama_process::ServerStatus;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/completions", post(chat_completions))
}

#[derive(Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    #[serde(default = "default_stream")]
    pub stream: bool,
    #[serde(flatten)]
    pub params: Value,
}

#[derive(Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

fn default_stream() -> bool { true }

async fn chat_completions(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> AppResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    // Read status and port while holding the lock, then release it
    let (status, port) = {
        let llama = state.llama.read().await;
        (llama.current_status().clone(), llama.port().await)
    };

    if status != ServerStatus::Running {
        return Err(crate::error::AppError::ServerNotRunning);
    }

    let stream = crate::services::llama_process::create_chat_stream(port, req).await?;
    Ok(Sse::new(stream))
}

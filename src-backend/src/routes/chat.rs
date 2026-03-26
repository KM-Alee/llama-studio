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

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    #[serde(default = "default_stream")]
    pub stream: bool,
    // Inference parameters (all optional — llama.cpp uses its defaults if omitted)
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub top_k: Option<i32>,
    pub repeat_penalty: Option<f64>,
    pub max_tokens: Option<i32>,
    pub stop: Option<Vec<String>>,
    pub frequency_penalty: Option<f64>,
    pub presence_penalty: Option<f64>,
    pub seed: Option<i64>,
    pub grammar: Option<String>,
    pub system_prompt: Option<String>,
}

#[derive(Debug, Deserialize)]
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

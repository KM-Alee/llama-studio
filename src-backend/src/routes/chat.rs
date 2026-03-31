use axum::{
    Json, Router,
    extract::State,
    response::sse::{Event, Sse},
    routing::post,
};
use futures::stream::Stream;
use serde::Deserialize;
use std::convert::Infallible;

use crate::error::AppResult;
use crate::services::llama_process::ServerStatus;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/completions", post(chat_completions))
}

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    #[allow(dead_code)]
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
    pub min_p: Option<f64>,
    pub typical_p: Option<f64>,
    pub mirostat: Option<i32>,
    pub mirostat_tau: Option<f64>,
    pub mirostat_eta: Option<f64>,
    pub tfs_z: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

fn default_stream() -> bool {
    true
}

async fn chat_completions(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> AppResult<Sse<impl Stream<Item = Result<Event, Infallible>>>> {
    // Validate input
    if req.messages.is_empty() {
        return Err(crate::error::AppError::BadRequest(
            "Messages cannot be empty".into(),
        ));
    }

    // Validate role values
    for msg in &req.messages {
        match msg.role.as_str() {
            "system" | "user" | "assistant" => {}
            _ => {
                return Err(crate::error::AppError::BadRequest(format!(
                    "Invalid message role: {}",
                    msg.role
                )));
            }
        }
    }

    // Validate temperature range
    if let Some(temp) = req.temperature
        && !(0.0..=2.0).contains(&temp)
    {
        return Err(crate::error::AppError::BadRequest(
            "Temperature must be between 0.0 and 2.0".into(),
        ));
    }

    // Validate top_p range
    if let Some(top_p) = req.top_p
        && !(0.0..=1.0).contains(&top_p)
    {
        return Err(crate::error::AppError::BadRequest(
            "top_p must be between 0.0 and 1.0".into(),
        ));
    }

    // Validate max_tokens
    if let Some(max_tokens) = req.max_tokens
        && max_tokens < 1
    {
        return Err(crate::error::AppError::BadRequest(
            "max_tokens must be positive".into(),
        ));
    }

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

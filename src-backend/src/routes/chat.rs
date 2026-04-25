use axum::{Json, Router, extract::State, response::sse::Sse, routing::post};

pub use crate::app_core::chat_types::{ChatMessage, ChatRequest};

use crate::app_core::chat;
use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/completions", post(chat_completions))
}

async fn chat_completions(
    State(state): State<AppState>,
    Json(req): Json<ChatRequest>,
) -> AppResult<Sse<chat::ChatSseStream>> {
    chat::chat_completions_sse(&state, req).await
}

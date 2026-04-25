use axum::response::sse::{Event, Sse};
use futures::stream::Stream;
use std::convert::Infallible;
use std::pin::Pin;

use crate::app_core::chat_types::ChatRequest;
use crate::error::{AppError, AppResult};
use crate::services::llama_process::ServerStatus;
use crate::services::llama_process::{self};
use crate::state::AppState;

pub type ChatSseStream = Pin<Box<dyn Stream<Item = Result<Event, Infallible>> + Send>>;

/// Validate and build the SSE stream for chat completions (HTTP route wrapper).
pub async fn chat_completions_sse(
    state: &AppState,
    req: ChatRequest,
) -> AppResult<Sse<ChatSseStream>> {
    validate_chat_request(&req)?;

    let (status, port) = {
        let llama = state.llama.read().await;
        (llama.current_status().clone(), llama.port().await)
    };

    if status != ServerStatus::Running {
        return Err(AppError::ServerNotRunning);
    }

    let stream = llama_process::create_chat_stream(port, req).await?;
    Ok(Sse::new(Box::pin(stream)))
}

pub fn validate_chat_request(req: &ChatRequest) -> AppResult<()> {
    if req.messages.is_empty() {
        return Err(AppError::BadRequest("Messages cannot be empty".into()));
    }

    for msg in &req.messages {
        match msg.role.as_str() {
            "system" | "user" | "assistant" => {}
            _ => {
                return Err(AppError::BadRequest(format!(
                    "Invalid message role: {}",
                    msg.role
                )));
            }
        }
    }

    if let Some(temp) = req.temperature
        && !(0.0..=2.0).contains(&temp)
    {
        return Err(AppError::BadRequest(
            "Temperature must be between 0.0 and 2.0".into(),
        ));
    }

    if let Some(top_p) = req.top_p
        && !(0.0..=1.0).contains(&top_p)
    {
        return Err(AppError::BadRequest(
            "top_p must be between 0.0 and 1.0".into(),
        ));
    }

    if let Some(max_tokens) = req.max_tokens
        && max_tokens < 1
    {
        return Err(AppError::BadRequest("max_tokens must be positive".into()));
    }

    Ok(())
}

pub async fn assert_llama_running(state: &AppState) -> AppResult<u16> {
    let (status, port) = {
        let llama = state.llama.read().await;
        (llama.current_status().clone(), llama.port().await)
    };
    if status != ServerStatus::Running {
        return Err(AppError::ServerNotRunning);
    }
    Ok(port)
}

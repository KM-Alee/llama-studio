use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

/// Application error type that converts into HTTP responses.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Server not running")]
    ServerNotRunning,

    #[error("Server already running")]
    ServerAlreadyRunning,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Internal(e) => {
                tracing::error!("Internal error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
            AppError::Database(e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
            }
            AppError::ServerNotRunning => {
                (StatusCode::SERVICE_UNAVAILABLE, "llama.cpp server is not running".to_string())
            }
            AppError::ServerAlreadyRunning => {
                (StatusCode::CONFLICT, "llama.cpp server is already running".to_string())
            }
        };

        let body = json!({ "error": message });
        (status, axum::Json(body)).into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;

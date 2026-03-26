use axum::{
    Router,
    extract::State,
    routing::{get, post},
    Json,
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_downloads))
        .route("/start", post(start_download))
        .route("/{id}/cancel", post(cancel_download))
}

async fn list_downloads(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let downloads = state.downloads.list().await;
    Ok(Json(json!({ "downloads": downloads })))
}

#[derive(Deserialize)]
struct StartDownloadRequest {
    url: String,
    filename: String,
}

async fn start_download(
    State(state): State<AppState>,
    Json(body): Json<StartDownloadRequest>,
) -> AppResult<Json<Value>> {
    // Validate filename to prevent path traversal
    if body.filename.contains('/') || body.filename.contains('\\') || body.filename.contains("..") {
        return Err(AppError::BadRequest("Invalid filename".into()));
    }
    if !body.filename.ends_with(".gguf") {
        return Err(AppError::BadRequest("Filename must end with .gguf".into()));
    }

    // Validate URL
    let url_parsed = url::Url::parse(&body.url)
        .map_err(|_| AppError::BadRequest("Invalid URL".into()))?;

    match url_parsed.scheme() {
        "https" => {}
        "http" => {
            let host = url_parsed.host_str().unwrap_or("");
            if !host.ends_with("huggingface.co") {
                return Err(AppError::BadRequest("Only HTTPS URLs are allowed (except huggingface.co)".into()));
            }
        }
        _ => return Err(AppError::BadRequest("Only HTTP(S) URLs are allowed".into())),
    }

    // Block internal/private network addresses
    if let Some(host) = url_parsed.host_str() {
        let blocked = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"];
        if blocked.contains(&host) || host.starts_with("10.") || host.starts_with("192.168.") || host.starts_with("172.") {
            return Err(AppError::BadRequest("Internal network addresses are not allowed".into()));
        }
    }

    let id = state.downloads.start_download(body.url, body.filename).await
        .map_err(AppError::Internal)?;

    Ok(Json(json!({ "id": id })))
}

async fn cancel_download(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> AppResult<Json<Value>> {
    state.downloads.cancel(&id).await
        .map_err(AppError::Internal)?;
    Ok(Json(json!({ "cancelled": true })))
}

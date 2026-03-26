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

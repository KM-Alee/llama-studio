use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, post},
};
use serde_json::Value;

use crate::app_core::downloads::{self, StartDownloadRequest};
use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_downloads))
        .route("/start", post(start_download))
        .route("/{id}/cancel", post(cancel_download))
}

async fn list_downloads(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(downloads::list_downloads(&state).await?))
}

async fn start_download(
    State(state): State<AppState>,
    Json(body): Json<StartDownloadRequest>,
) -> AppResult<Json<Value>> {
    Ok(Json(downloads::start_download(&state, body).await?))
}

async fn cancel_download(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    Ok(Json(downloads::cancel_download(&state, &id).await?))
}

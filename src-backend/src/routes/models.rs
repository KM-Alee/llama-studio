use axum::{
    Json, Router,
    extract::{Path, State},
    routing::{get, post},
};
use serde_json::Value;

use crate::app_core::models::{self, ImportModelRequest};
use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_models))
        .route("/scan", post(scan_models))
        .route("/import", post(import_model))
        .route("/{id}/inspect", get(inspect_model))
        .route("/{id}/analytics", get(get_model_analytics))
        .route("/{id}", get(get_model).delete(delete_model))
}

async fn list_models(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(models::list_models(&state).await?))
}

async fn scan_models(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(models::scan_models(&state).await?))
}

async fn import_model(
    State(state): State<AppState>,
    Json(body): Json<ImportModelRequest>,
) -> AppResult<Json<Value>> {
    Ok(Json(models::import_model(&state, body).await?))
}

async fn get_model(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    Ok(Json(models::get_model(&state, &id).await?))
}

async fn inspect_model(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    Ok(Json(models::inspect_model(&state, &id).await?))
}

async fn get_model_analytics(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    Ok(Json(models::get_model_analytics(&state, &id).await?))
}

async fn delete_model(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    Ok(Json(models::delete_model(&state, &id).await?))
}

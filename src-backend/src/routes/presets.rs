use axum::{
    Json, Router,
    extract::{Path, State},
    routing::get,
};
use serde_json::Value;

use crate::app_core::presets;
use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_presets).post(create_preset))
        .route(
            "/{id}",
            get(get_preset).put(update_preset).delete(delete_preset),
        )
}

async fn list_presets(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(presets::list_presets(&state).await?))
}

async fn create_preset(
    State(state): State<AppState>,
    Json(req): Json<Value>,
) -> AppResult<Json<Value>> {
    Ok(Json(presets::create_preset(&state, req).await?))
}

async fn get_preset(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    Ok(Json(presets::get_preset(&state, &id).await?))
}

async fn update_preset(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<Value>,
) -> AppResult<Json<Value>> {
    Ok(Json(presets::update_preset(&state, &id, req).await?))
}

async fn delete_preset(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    Ok(Json(presets::delete_preset(&state, &id).await?))
}

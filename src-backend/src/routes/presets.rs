use axum::{
    Router,
    extract::{State, Path},
    routing::{get, post, put, delete},
    Json,
};
use serde_json::{Value, json};

use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_presets).post(create_preset))
        .route("/{id}", get(get_preset).put(update_preset).delete(delete_preset))
}

async fn list_presets(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let presets = state.presets.list().await?;
    Ok(Json(json!({ "presets": presets })))
}

async fn create_preset(
    State(state): State<AppState>,
    Json(req): Json<Value>,
) -> AppResult<Json<Value>> {
    let preset = state.presets.create(req).await?;
    Ok(Json(json!(preset)))
}

async fn get_preset(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let preset = state.presets.get(&id).await?;
    Ok(Json(json!(preset)))
}

async fn update_preset(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<Value>,
) -> AppResult<Json<Value>> {
    let preset = state.presets.update(&id, req).await?;
    Ok(Json(json!(preset)))
}

async fn delete_preset(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    state.presets.delete(&id).await?;
    Ok(Json(json!({ "deleted": true })))
}

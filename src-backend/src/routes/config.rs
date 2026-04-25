use axum::{Json, Router, extract::State, routing::get};
use serde_json::Value;

use crate::app_core::config;
use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(get_config).put(update_config))
}

async fn get_config(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(config::get_config(&state).await?))
}

async fn update_config(
    State(state): State<AppState>,
    Json(req): Json<Value>,
) -> AppResult<Json<Value>> {
    Ok(Json(config::update_config(&state, req).await?))
}

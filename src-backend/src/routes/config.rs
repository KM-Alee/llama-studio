use axum::{Json, Router, extract::State, routing::get};
use serde_json::{Value, json};

use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(get_config).put(update_config))
}

async fn get_config(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let config = state.config.get_all().await?;
    Ok(Json(json!(config)))
}

async fn update_config(
    State(state): State<AppState>,
    Json(req): Json<Value>,
) -> AppResult<Json<Value>> {
    let config = state.config.update(req).await?;
    Ok(Json(json!(config)))
}

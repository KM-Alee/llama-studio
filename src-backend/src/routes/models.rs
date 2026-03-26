use axum::{
    Router,
    extract::State,
    routing::{get, post, delete},
    Json,
};
use serde_json::{Value, json};

use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_models))
        .route("/scan", post(scan_models))
        .route("/{id}", get(get_model).delete(delete_model))
}

async fn list_models(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let models = state.models.list().await?;
    Ok(Json(json!({ "models": models })))
}

async fn scan_models(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let count = state.models.scan().await?;
    Ok(Json(json!({ "scanned": count })))
}

async fn get_model(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> AppResult<Json<Value>> {
    let model = state.models.get(&id).await?;
    Ok(Json(json!(model)))
}

async fn delete_model(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> AppResult<Json<Value>> {
    state.models.delete(&id).await?;
    Ok(Json(json!({ "deleted": true })))
}

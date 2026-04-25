use axum::{
    Json, Router,
    extract::State,
    routing::{get, post},
};
use serde_json::Value;

use crate::app_core::server::{self, FlagsRequest, StartServerRequest};
use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/start", post(start_server))
        .route("/stop", post(stop_server))
        .route("/status", get(server_status))
        .route("/logs", get(get_logs))
        .route("/flags", get(get_flags).put(set_flags))
        .route("/dependencies", get(get_dependencies))
        .route("/metrics", get(get_metrics))
        .route("/hardware", get(detect_hardware))
}

async fn start_server(
    State(state): State<AppState>,
    Json(req): Json<StartServerRequest>,
) -> AppResult<Json<Value>> {
    Ok(Json(server::start_server(&state, req).await?))
}

async fn stop_server(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(server::stop_server(&state).await?))
}

async fn server_status(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(server::server_status(&state).await?))
}

async fn get_logs(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(server::get_logs(&state).await?))
}

async fn get_flags(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(server::get_flags(&state).await?))
}

async fn set_flags(
    State(state): State<AppState>,
    Json(req): Json<FlagsRequest>,
) -> AppResult<Json<Value>> {
    Ok(Json(server::set_flags(&state, req.flags).await?))
}

async fn get_metrics(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(server::get_metrics(&state).await?))
}

async fn get_dependencies(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(server::get_dependencies(&state).await?))
}

async fn detect_hardware(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(server::detect_hardware(&state).await?))
}

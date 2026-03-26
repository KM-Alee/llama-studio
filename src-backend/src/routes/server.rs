use axum::{
    Router,
    extract::State,
    routing::{get, post},
    Json,
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::error::AppResult;
use crate::state::AppState;
use crate::services::llama_process;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/start", post(start_server))
        .route("/stop", post(stop_server))
        .route("/status", get(server_status))
}

#[derive(Deserialize)]
pub struct StartRequest {
    pub model_id: String,
    #[serde(default)]
    pub extra_args: Vec<String>,
}

async fn start_server(
    State(state): State<AppState>,
    Json(req): Json<StartRequest>,
) -> AppResult<Json<Value>> {
    {
        let mut llama = state.llama.write().await;
        llama.start(&req.model_id, &req.extra_args).await?;
    }

    // Spawn a background task to poll /health and transition Starting → Running
    let llama_clone = state.llama.clone();
    tokio::spawn(llama_process::poll_health_until_ready(llama_clone));

    Ok(Json(json!({ "status": "starting" })))
}

async fn stop_server(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let mut llama = state.llama.write().await;
    llama.stop().await?;
    Ok(Json(json!({ "status": "stopped" })))
}

async fn server_status(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let llama = state.llama.read().await;
    let status = llama.status_str();
    let model = llama.current_model().map(String::from);
    Ok(Json(json!({ "status": status, "model": model })))
}

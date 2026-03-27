use axum::{
    Json, Router,
    extract::State,
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::error::{AppError, AppResult};
use crate::services::llama_process;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/start", post(start_server))
        .route("/stop", post(stop_server))
        .route("/status", get(server_status))
        .route("/logs", get(get_logs))
        .route("/flags", get(get_flags).put(set_flags))
        .route("/metrics", get(get_metrics))
        .route("/hardware", get(detect_hardware))
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
    tokio::spawn(llama_process::poll_health_until_ready(llama_clone.clone()));
    tokio::spawn(llama_process::monitor_for_exit(llama_clone));

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

async fn get_logs(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let llama = state.llama.read().await;
    let logs = llama.get_logs();
    Ok(Json(json!({ "logs": logs })))
}

#[derive(Deserialize)]
pub struct FlagsRequest {
    pub flags: Vec<String>,
}

async fn get_flags(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let llama = state.llama.read().await;
    let flags = llama.get_custom_flags();
    Ok(Json(json!({ "flags": flags })))
}

async fn set_flags(
    State(state): State<AppState>,
    Json(req): Json<FlagsRequest>,
) -> AppResult<Json<Value>> {
    let mut llama = state.llama.write().await;
    llama.set_custom_flags(req.flags.clone());
    Ok(Json(json!({ "flags": req.flags })))
}

async fn get_metrics(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let llama = state.llama.read().await;
    let port = llama.port().await;
    let status = llama.current_status().clone();

    if status != llama_process::ServerStatus::Running {
        return Ok(Json(json!({ "available": false })));
    }

    drop(llama);

    // Query llama.cpp's /metrics or /health for performance data
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap_or_default();

    let health_url = format!("http://127.0.0.1:{}/health", port);
    let health = match client.get(&health_url).send().await {
        Ok(resp) => resp.json::<Value>().await.unwrap_or(json!({})),
        Err(_) => json!({}),
    };

    Ok(Json(json!({
        "available": true,
        "health": health,
    })))
}

async fn detect_hardware(_state: State<AppState>) -> AppResult<Json<Value>> {
    // Read basic system info (cross-platform)
    let mut info = serde_json::Map::new();

    // CPU info
    info.insert(
        "cpu_cores".into(),
        json!(
            std::thread::available_parallelism()
                .map(|p| p.get())
                .unwrap_or(1)
        ),
    );

    // Total system RAM
    #[cfg(target_os = "linux")]
    {
        if let Ok(meminfo) = tokio::fs::read_to_string("/proc/meminfo").await {
            for line in meminfo.lines() {
                if let Some(rest) = line.strip_prefix("MemTotal:") {
                    let kb: u64 = rest
                        .trim()
                        .split_whitespace()
                        .next()
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0);
                    info.insert("total_ram_bytes".into(), json!(kb * 1024));
                    break;
                }
            }
        }
    }

    Ok(Json(json!({ "hardware": info })))
}

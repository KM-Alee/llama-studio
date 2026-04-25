use serde::Deserialize;
use serde_json::{Value, json};

use crate::error::AppResult;
use crate::services::llama_process::{self, ServerStatus};
use crate::services::runtime_tools;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct StartServerRequest {
    pub model_id: String,
    #[serde(default)]
    pub extra_args: Vec<String>,
}

pub async fn start_server(state: &AppState, req: StartServerRequest) -> AppResult<Value> {
    {
        let mut llama = state.llama.write().await;
        llama.start(&req.model_id, &req.extra_args).await?;
    }

    let llama_clone = state.llama.clone();
    tokio::spawn(llama_process::poll_health_until_ready(llama_clone.clone()));
    tokio::spawn(llama_process::monitor_for_exit(llama_clone));

    Ok(json!({ "status": "starting" }))
}

pub async fn stop_server(state: &AppState) -> AppResult<Value> {
    let mut llama = state.llama.write().await;
    llama.stop().await?;
    Ok(json!({ "status": "stopped" }))
}

pub async fn server_status(state: &AppState) -> AppResult<Value> {
    let llama = state.llama.read().await;
    let status = llama.status_str();
    let model = llama.current_model().map(String::from);
    Ok(json!({ "status": status, "model": model }))
}

pub async fn get_logs(state: &AppState) -> AppResult<Value> {
    let llama = state.llama.read().await;
    let logs = llama.get_logs();
    Ok(json!({ "logs": logs }))
}

#[derive(Deserialize)]
pub struct FlagsRequest {
    pub flags: Vec<String>,
}

pub async fn get_flags(state: &AppState) -> AppResult<Value> {
    let llama = state.llama.read().await;
    let flags = llama.get_custom_flags();
    Ok(json!({ "flags": flags }))
}

pub async fn set_flags(state: &AppState, flags: Vec<String>) -> AppResult<Value> {
    let mut llama = state.llama.write().await;
    llama.set_custom_flags(flags.clone());
    Ok(json!({ "flags": flags }))
}

pub async fn get_metrics(state: &AppState) -> AppResult<Value> {
    let llama = state.llama.read().await;
    let port = llama.port().await;
    let status = llama.current_status().clone();

    if status != ServerStatus::Running {
        return Ok(json!({ "available": false }));
    }

    drop(llama);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap_or_default();

    let health_url = format!("http://127.0.0.1:{}/health", port);
    let health = match client.get(&health_url).send().await {
        Ok(resp) => resp.json::<Value>().await.unwrap_or(json!({})),
        Err(_) => json!({}),
    };

    Ok(json!({
        "available": true,
        "health": health,
    }))
}

pub async fn get_dependencies(state: &AppState) -> AppResult<Value> {
    let config = state.config.get_all().await?;
    let dependencies = runtime_tools::detect_runtime_dependencies(&config.llama_cpp_path);

    Ok(json!({
        "platform": std::env::consts::OS,
        "backend_bundled": true,
        "dependencies": dependencies,
    }))
}

pub async fn detect_hardware(_state: &AppState) -> AppResult<Value> {
    let mut info = serde_json::Map::new();

    info.insert(
        "cpu_cores".into(),
        json!(
            std::thread::available_parallelism()
                .map(|p| p.get())
                .unwrap_or(1)
        ),
    );

    #[cfg(target_os = "linux")]
    {
        if let Ok(meminfo) = tokio::fs::read_to_string("/proc/meminfo").await {
            for line in meminfo.lines() {
                if let Some(rest) = line.strip_prefix("MemTotal:") {
                    let kb: u64 = rest
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

    Ok(json!({ "hardware": info }))
}

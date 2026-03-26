use std::process::Stdio;
use std::sync::Arc;
use std::convert::Infallible;

use anyhow::Result;
use axum::response::sse::Event;
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use tokio::process::{Child, Command};

use crate::db::Database;
use crate::error::{AppError, AppResult};
use crate::routes::chat::ChatRequest;
use crate::services::config_store::ConfigStore;

/// How long to wait for llama.cpp /health to become ready after spawn.
const HEALTH_POLL_INTERVAL_MS: u64 = 500;
/// Maximum number of health polls before giving up.
const HEALTH_POLL_MAX_ATTEMPTS: u32 = 60;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServerStatus {
    Stopped,
    Starting,
    Running,
    Stopping,
    Error,
}

impl std::fmt::Display for ServerStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Stopped => write!(f, "stopped"),
            Self::Starting => write!(f, "starting"),
            Self::Running => write!(f, "running"),
            Self::Stopping => write!(f, "stopping"),
            Self::Error => write!(f, "error"),
        }
    }
}

pub struct LlamaProcessManager {
    config: Arc<ConfigStore>,
    db: Arc<Database>,
    child: Option<Child>,
    status: ServerStatus,
    current_model: Option<String>,
}

impl LlamaProcessManager {
    pub fn new(config: Arc<ConfigStore>, db: Arc<Database>) -> Self {
        Self {
            config,
            db,
            child: None,
            status: ServerStatus::Stopped,
            current_model: None,
        }
    }

    pub fn current_status(&self) -> &ServerStatus {
        &self.status
    }

    pub fn current_model(&self) -> Option<&str> {
        self.current_model.as_deref()
    }

    pub async fn port(&self) -> u16 {
        self.config.get_llama_port().await
    }

    /// Resolve model_id to a filesystem path by looking it up in the database.
    /// Falls back to using model_id as a literal path if not found in DB.
    async fn resolve_model_path(&self, model_id: &str) -> String {
        match self.db.get_model(model_id).await {
            Ok(model) => model.path,
            Err(_) => model_id.to_string(),
        }
    }

    pub async fn start(&mut self, model_id: &str, extra_args: &[String]) -> AppResult<()> {
        if self.status == ServerStatus::Running {
            return Err(AppError::ServerAlreadyRunning);
        }

        self.status = ServerStatus::Starting;

        let model_path = self.resolve_model_path(model_id).await;
        let config = self.config.get_all().await
            .map_err(AppError::Internal)?;

        let llama_path = if config.llama_cpp_path.is_empty() {
            "llama-server".to_string()
        } else {
            config.llama_cpp_path.clone()
        };

        let mut cmd = Command::new(&llama_path);
        cmd.arg("-m").arg(&model_path)
            .arg("--port").arg(config.llama_server_port.to_string())
            .arg("--host").arg("127.0.0.1")
            .arg("-c").arg(config.context_size.to_string())
            .arg("-ngl").arg(config.gpu_layers.to_string())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if config.threads > 0 {
            cmd.arg("-t").arg(config.threads.to_string());
        }

        if config.flash_attention {
            cmd.arg("-fa");
        }

        for arg in extra_args {
            cmd.arg(arg);
        }

        tracing::info!(model = %model_path, binary = %llama_path, "Spawning llama.cpp server");

        match cmd.spawn() {
            Ok(child) => {
                self.child = Some(child);
                self.current_model = Some(model_id.to_string());
                // Status stays Starting — the caller should spawn a health poll task
                Ok(())
            }
            Err(e) => {
                self.status = ServerStatus::Error;
                Err(AppError::Internal(anyhow::anyhow!("Failed to start llama.cpp: {}", e)))
            }
        }
    }

    /// Mark the server as running. Called by the health poll task once /health returns ok.
    pub fn mark_running(&mut self) {
        if self.status == ServerStatus::Starting {
            self.status = ServerStatus::Running;
            tracing::info!("llama.cpp server is ready");
        }
    }

    /// Mark the server as errored. Called by the health poll task if it times out.
    pub fn mark_error(&mut self) {
        self.status = ServerStatus::Error;
        tracing::error!("llama.cpp server failed to become ready");
    }

    pub async fn stop(&mut self) -> AppResult<()> {
        if self.status == ServerStatus::Stopped {
            return Ok(());
        }

        self.status = ServerStatus::Stopping;

        if let Some(mut child) = self.child.take() {
            let _ = child.kill().await;
            let _ = child.wait().await;
        }

        self.status = ServerStatus::Stopped;
        self.current_model = None;
        tracing::info!("llama.cpp server stopped");
        Ok(())
    }

    pub async fn restart(&mut self, model_id: &str, extra_args: &[String]) -> AppResult<()> {
        self.stop().await?;
        self.start(model_id, extra_args).await
    }

    pub fn status_str(&self) -> &str {
        match self.status {
            ServerStatus::Stopped => "stopped",
            ServerStatus::Starting => "starting",
            ServerStatus::Running => "running",
            ServerStatus::Stopping => "stopping",
            ServerStatus::Error => "error",
        }
    }
}

/// Poll llama.cpp's /health endpoint until it returns ok.
/// Updates the process manager status via the shared RwLock.
pub async fn poll_health_until_ready(
    llama: Arc<tokio::sync::RwLock<LlamaProcessManager>>,
) {
    let port = {
        let mgr = llama.read().await;
        mgr.port().await
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(2))
        .build()
        .unwrap_or_default();

    let url = format!("http://127.0.0.1:{}/health", port);

    for attempt in 1..=HEALTH_POLL_MAX_ATTEMPTS {
        tokio::time::sleep(std::time::Duration::from_millis(HEALTH_POLL_INTERVAL_MS)).await;

        // Check if process is still alive / still Starting
        {
            let mgr = llama.read().await;
            if *mgr.current_status() != ServerStatus::Starting {
                return; // Aborted or already transitioned
            }
        }

        match client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                let mut mgr = llama.write().await;
                mgr.mark_running();
                return;
            }
            _ => {
                tracing::debug!(attempt, "Waiting for llama.cpp health...");
            }
        }
    }

    // Timed out
    let mut mgr = llama.write().await;
    mgr.mark_error();
}

/// Creates a chat completion SSE stream by proxying to llama.cpp.
/// Properly parses llama.cpp's SSE output and re-emits clean SSE events.
pub async fn create_chat_stream(
    port: u16,
    req: ChatRequest,
) -> AppResult<impl Stream<Item = Result<Event, Infallible>>> {
    let url = format!("http://127.0.0.1:{}/v1/chat/completions", port);

    let body = serde_json::json!({
        "messages": req.messages.iter().map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content,
            })
        }).collect::<Vec<_>>(),
        "stream": true,
    });

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to connect to llama.cpp: {}", e)))?;

    let byte_stream = response.bytes_stream();

    use futures::StreamExt;

    // llama.cpp sends SSE-formatted lines: "data: {...}\n\n"
    // We need to parse each line, extract the JSON, and re-emit as proper Axum SSE events.
    let event_stream = byte_stream
        .map(|chunk| {
            match chunk {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    let mut events = Vec::new();

                    for line in text.lines() {
                        let line = line.trim();
                        if line.is_empty() {
                            continue;
                        }
                        if let Some(data) = line.strip_prefix("data: ") {
                            if data == "[DONE]" {
                                events.push(Ok(Event::default().data("[DONE]")));
                            } else {
                                events.push(Ok(Event::default().data(data.to_string())));
                            }
                        }
                    }

                    futures::stream::iter(events)
                }
                Err(e) => {
                    let err_event = Event::default()
                        .data(format!("{{\"error\": \"{}\"}}", e));
                    futures::stream::iter(vec![Ok(err_event)])
                }
            }
        })
        .flatten();

    Ok(event_stream)
}

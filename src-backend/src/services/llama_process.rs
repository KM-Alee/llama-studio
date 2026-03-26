use std::process::Stdio;
use std::sync::Arc;
use std::convert::Infallible;

use anyhow::Result;
use axum::response::sse::Event;
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use tokio::process::{Child, Command};

use crate::error::{AppError, AppResult};
use crate::routes::chat::ChatRequest;
use crate::services::config_store::ConfigStore;

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
    child: Option<Child>,
    status: ServerStatus,
    current_model: Option<String>,
}

impl LlamaProcessManager {
    pub fn new(config: Arc<ConfigStore>) -> Self {
        Self {
            config,
            child: None,
            status: ServerStatus::Stopped,
            current_model: None,
        }
    }

    pub fn current_status(&self) -> &ServerStatus {
        &self.status
    }

    pub async fn port(&self) -> u16 {
        self.config.get_llama_port().await
    }

    pub async fn start(&mut self, model_id: &str, extra_args: &[String]) -> AppResult<()> {
        if self.status == ServerStatus::Running {
            return Err(AppError::ServerAlreadyRunning);
        }

        self.status = ServerStatus::Starting;

        let config = self.config.get_all().await
            .map_err(|e| AppError::Internal(e))?;

        let llama_path = if config.llama_cpp_path.is_empty() {
            "llama-server".to_string()
        } else {
            config.llama_cpp_path.clone()
        };

        let mut cmd = Command::new(&llama_path);
        cmd.arg("-m").arg(model_id)
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

        match cmd.spawn() {
            Ok(child) => {
                self.child = Some(child);
                self.current_model = Some(model_id.to_string());
                self.status = ServerStatus::Running;
                tracing::info!("llama.cpp server started with model: {}", model_id);
                Ok(())
            }
            Err(e) => {
                self.status = ServerStatus::Error;
                Err(AppError::Internal(anyhow::anyhow!("Failed to start llama.cpp: {}", e)))
            }
        }
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

    pub fn status(&self) -> &str {
        match self.status {
            ServerStatus::Stopped => "stopped",
            ServerStatus::Starting => "starting",
            ServerStatus::Running => "running",
            ServerStatus::Stopping => "stopping",
            ServerStatus::Error => "error",
        }
    }
}

/// Creates a chat completion SSE stream by proxying to llama.cpp.
/// This is a free function so it doesn't need to borrow LlamaProcessManager.
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
    let event_stream = byte_stream.map(|chunk| {
        match chunk {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                Ok(Event::default().data(text.to_string()))
            }
            Err(e) => {
                Ok(Event::default().data(format!("{{\"error\": \"{}\"}}", e)))
            }
        }
    });

    Ok(event_stream)
}

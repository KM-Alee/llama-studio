use std::convert::Infallible;
use std::process::Stdio;
use std::sync::Arc;

use anyhow::Result;
use axum::response::sse::Event;
use futures::stream::Stream;
use serde::{Deserialize, Serialize};
use tokio::process::{Child, Command};
use tokio::sync::broadcast;

use crate::db::Database;
use crate::error::{AppError, AppResult};
use crate::routes::chat::ChatRequest;
use crate::services::config_store::ConfigStore;

/// How long to wait for llama.cpp /health to become ready after spawn.
const HEALTH_POLL_INTERVAL_MS: u64 = 500;
/// Maximum number of health polls before giving up.
const HEALTH_POLL_MAX_ATTEMPTS: u32 = 60;
/// Max log lines to keep in memory.
const MAX_LOG_LINES: usize = 2000;
/// How often to check whether the running process is still alive.
const EXIT_MONITOR_INTERVAL_MS: u64 = 3000;

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

#[derive(Debug, Clone, Serialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub line: String,
}

pub struct LlamaProcessManager {
    config: Arc<ConfigStore>,
    db: Arc<Database>,
    child: Option<Child>,
    status: ServerStatus,
    current_model: Option<String>,
    /// Port captured at start time; avoids using a stale config value after the server starts.
    running_port: Option<u16>,
    /// Shared log ring-buffer — also written by the stderr-reader background task.
    logs: Arc<std::sync::Mutex<Vec<LogEntry>>>,
    log_tx: broadcast::Sender<LogEntry>,
    custom_flags: Vec<String>,
}

impl LlamaProcessManager {
    pub fn new(config: Arc<ConfigStore>, db: Arc<Database>) -> Self {
        let (log_tx, _) = broadcast::channel(256);
        Self {
            config,
            db,
            child: None,
            status: ServerStatus::Stopped,
            current_model: None,
            running_port: None,
            logs: Arc::new(std::sync::Mutex::new(Vec::new())),
            log_tx,
            custom_flags: Vec::new(),
        }
    }

    pub fn current_status(&self) -> &ServerStatus {
        &self.status
    }

    pub fn current_model(&self) -> Option<&str> {
        self.current_model.as_deref()
    }

    /// Returns the port the running llama.cpp server is bound to.
    ///
    /// Uses the port captured at `start()` time so that a subsequent config change cannot
    /// silently redirect chat proxying to a port where no server is listening.
    pub async fn port(&self) -> u16 {
        if let Some(port) = self.running_port {
            return port;
        }
        self.config.get_llama_port().await
    }

    pub fn get_logs(&self) -> Vec<LogEntry> {
        self.logs.lock().unwrap().clone()
    }

    pub fn subscribe_logs(&self) -> broadcast::Receiver<LogEntry> {
        self.log_tx.subscribe()
    }

    pub fn set_custom_flags(&mut self, flags: Vec<String>) {
        self.custom_flags = flags;
    }

    pub fn get_custom_flags(&self) -> &[String] {
        &self.custom_flags
    }

    fn push_log(&mut self, line: String) {
        let entry = LogEntry {
            timestamp: chrono::Utc::now().to_rfc3339(),
            line,
        };
        let _ = self.log_tx.send(entry.clone());
        let mut logs = self.logs.lock().unwrap();
        logs.push(entry);
        if logs.len() > MAX_LOG_LINES {
            let excess = logs.len() - MAX_LOG_LINES;
            logs.drain(0..excess);
        }
    }

    /// Validate a CLI flag to prevent injection of dangerous arguments.
    fn validate_flag(flag: &str) -> bool {
        let dangerous = [
            "--api-key",
            "--api-key-file",
            "--log-file",
            "--log-prefix",
            "-o",
            "--output",
            "--ssl-key-file",
            "--ssl-cert-file",
        ];
        let lower = flag.to_lowercase();
        !dangerous.iter().any(|d| lower.starts_with(d))
    }

    /// Resolve model_id to a filesystem path by looking it up in the database.
    async fn resolve_model_path(&self, model_id: &str) -> AppResult<String> {
        self.db
            .get_model(model_id)
            .await
            .map(|model| model.path)
            .map_err(|_| AppError::NotFound(format!("Model not found: {}", model_id)))
    }

    pub async fn start(&mut self, model_id: &str, extra_args: &[String]) -> AppResult<()> {
        if matches!(self.status, ServerStatus::Running | ServerStatus::Starting) {
            return Err(AppError::ServerAlreadyRunning);
        }

        self.status = ServerStatus::Starting;
        self.logs.lock().unwrap().clear();

        let model_path = self.resolve_model_path(model_id).await?;
        let config = self.config.get_all().await.map_err(AppError::Internal)?;

        // Capture the port now so chat proxying always uses the port this process
        // was actually launched on, even if the config changes later.
        self.running_port = Some(config.llama_server_port);

        let llama_path = if config.llama_cpp_path.is_empty() {
            "llama-server".to_string()
        } else {
            config.llama_cpp_path.clone()
        };

        let mut cmd = Command::new(&llama_path);
        cmd.arg("-m")
            .arg(&model_path)
            .arg("--port")
            .arg(config.llama_server_port.to_string())
            .arg("--host")
            .arg("127.0.0.1")
            .arg("-c")
            .arg(config.context_size.to_string())
            .arg("-ngl")
            .arg(config.gpu_layers.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::piped());

        if config.threads > 0 {
            cmd.arg("-t").arg(config.threads.to_string());
        }

        cmd.arg("--flash-attn")
            .arg(if config.flash_attention { "on" } else { "off" });

        if let Some(batch_size) = config.batch_size {
            cmd.arg("--batch-size").arg(batch_size.to_string());
        }
        if let Some(ubatch_size) = config.ubatch_size {
            cmd.arg("--ubatch-size").arg(ubatch_size.to_string());
        }
        if let Some(ref rope_scaling) = config.rope_scaling {
            cmd.arg("--rope-scaling").arg(rope_scaling);
        }
        if let Some(rope_freq_base) = config.rope_freq_base {
            cmd.arg("--rope-freq-base").arg(rope_freq_base.to_string());
        }
        if let Some(rope_freq_scale) = config.rope_freq_scale {
            cmd.arg("--rope-freq-scale")
                .arg(rope_freq_scale.to_string());
        }
        if let Some(mmap) = config.mmap {
            cmd.arg(if mmap { "--mmap" } else { "--no-mmap" });
        }
        if let Some(true) = config.mlock {
            cmd.arg("--mlock");
        }
        if let Some(cont_batching) = config.cont_batching {
            cmd.arg(if cont_batching {
                "--cont-batching"
            } else {
                "--no-cont-batching"
            });
        }

        // Apply custom CLI flags stored for advanced mode
        for flag in &self.custom_flags {
            if Self::validate_flag(flag) {
                cmd.arg(flag);
            } else {
                tracing::warn!(flag = %flag, "Blocked dangerous CLI flag");
            }
        }

        for arg in extra_args {
            if Self::validate_flag(arg) {
                cmd.arg(arg);
            } else {
                tracing::warn!(arg = %arg, "Blocked dangerous CLI argument");
            }
        }

        self.push_log(format!(
            "Starting llama.cpp: {} -m {}",
            llama_path, model_path
        ));
        tracing::info!(model = %model_path, binary = %llama_path, "Spawning llama.cpp server");

        // kill_on_drop ensures the child process is SIGKILL'd if the Child handle is
        // dropped (e.g., on panic or unexpected process exit), preventing llama.cpp from
        // becoming an orphan that holds GPU/RAM after AI Studio exits.
        cmd.kill_on_drop(true);

        match cmd.spawn() {
            Ok(mut child) => {
                // Capture stderr for log streaming
                // Capture stderr: broadcast to WS subscribers AND persist to ring buffer.
                if let Some(stderr) = child.stderr.take() {
                    let log_tx = self.log_tx.clone();
                    let log_store = self.logs.clone();
                    tokio::spawn(async move {
                        use tokio::io::{AsyncBufReadExt, BufReader};
                        let reader = BufReader::new(stderr);
                        let mut lines = reader.lines();
                        while let Ok(Some(line)) = lines.next_line().await {
                            let entry = LogEntry {
                                timestamp: chrono::Utc::now().to_rfc3339(),
                                line,
                            };
                            let _ = log_tx.send(entry.clone());
                            let mut logs = log_store.lock().unwrap();
                            logs.push(entry);
                            if logs.len() > MAX_LOG_LINES {
                                let excess = logs.len() - MAX_LOG_LINES;
                                logs.drain(0..excess);
                            }
                        }
                    });
                }
                self.child = Some(child);
                self.current_model = Some(model_id.to_string());
                Ok(())
            }
            Err(e) => {
                self.status = ServerStatus::Error;
                Err(AppError::Internal(anyhow::anyhow!(
                    "Failed to start llama.cpp: {}",
                    e
                )))
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
        self.running_port = None;
        self.push_log("llama.cpp server stopped".to_string());
        tracing::info!("llama.cpp server stopped");
        Ok(())
    }

    #[allow(dead_code)]
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
pub async fn poll_health_until_ready(llama: Arc<tokio::sync::RwLock<LlamaProcessManager>>) {
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

        // Check startup status and whether the child has already exited.
        {
            let mut mgr = llama.write().await;
            if *mgr.current_status() != ServerStatus::Starting {
                return; // Aborted or already transitioned
            }
            if let Some(child) = &mut mgr.child {
                match child.try_wait() {
                    Ok(Some(exit_status)) => {
                        let code = exit_status.code().unwrap_or(-1);
                        let msg = format!(
                            "llama.cpp exited with code {code} before becoming ready — \
                             check llama_cpp_path and model file"
                        );
                        tracing::error!(%msg);
                        mgr.push_log(msg);
                        mgr.mark_error();
                        return;
                    }
                    Ok(None) => {} // still running
                    Err(e) => tracing::warn!(err = %e, "Could not poll child exit status"),
                }
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

/// Monitor a running llama.cpp process and transition to Error if it exits unexpectedly.
/// Spawn this alongside `poll_health_until_ready` from the start-server handler.
pub async fn monitor_for_exit(llama: Arc<tokio::sync::RwLock<LlamaProcessManager>>) {
    // First wait until the server enters Running state (or bail on any terminal state).
    loop {
        tokio::time::sleep(std::time::Duration::from_millis(EXIT_MONITOR_INTERVAL_MS)).await;
        let status = {
            let mgr = llama.read().await;
            mgr.current_status().clone()
        };
        match status {
            ServerStatus::Running => break,
            ServerStatus::Stopped | ServerStatus::Error | ServerStatus::Stopping => return,
            ServerStatus::Starting => {}
        }
    }

    // Periodically check whether the child is still alive.
    loop {
        tokio::time::sleep(std::time::Duration::from_millis(EXIT_MONITOR_INTERVAL_MS)).await;
        let mut mgr = llama.write().await;
        if mgr.status != ServerStatus::Running {
            return;
        }
        if let Some(child) = &mut mgr.child {
            match child.try_wait() {
                Ok(Some(exit_status)) => {
                    let code = exit_status.code().unwrap_or(-1);
                    let msg = format!("llama.cpp exited unexpectedly (code {code})");
                    tracing::error!(%msg);
                    mgr.push_log(msg);
                    mgr.status = ServerStatus::Error;
                    mgr.child = None;
                    return;
                }
                Ok(None) => {} // still alive
                Err(e) => tracing::warn!(err = %e, "Could not poll child exit status"),
            }
        } else {
            return;
        }
    }
}

/// Creates a chat completion SSE stream by proxying to llama.cpp.
/// Properly parses llama.cpp's SSE output and re-emits clean SSE events.
pub async fn create_chat_stream(
    port: u16,
    req: ChatRequest,
) -> AppResult<impl Stream<Item = Result<Event, Infallible>>> {
    let url = format!("http://127.0.0.1:{}/v1/chat/completions", port);

    // Build messages, prepending system prompt if provided
    let mut messages: Vec<serde_json::Value> = Vec::new();
    if let Some(ref sys) = req.system_prompt {
        messages.push(serde_json::json!({"role": "system", "content": sys}));
    }
    for m in &req.messages {
        messages.push(serde_json::json!({"role": &m.role, "content": &m.content}));
    }

    let mut body = serde_json::json!({
        "messages": messages,
        "stream": true,
    });

    // Forward optional inference parameters to llama.cpp
    let obj = body.as_object_mut().unwrap();
    if let Some(v) = req.temperature {
        obj.insert("temperature".into(), v.into());
    }
    if let Some(v) = req.top_p {
        obj.insert("top_p".into(), v.into());
    }
    if let Some(v) = req.top_k {
        obj.insert("top_k".into(), v.into());
    }
    if let Some(v) = req.repeat_penalty {
        obj.insert("repeat_penalty".into(), v.into());
    }
    if let Some(v) = req.max_tokens {
        obj.insert("max_tokens".into(), v.into());
    }
    if let Some(ref v) = req.stop {
        obj.insert("stop".into(), serde_json::json!(v));
    }
    if let Some(v) = req.frequency_penalty {
        obj.insert("frequency_penalty".into(), v.into());
    }
    if let Some(v) = req.presence_penalty {
        obj.insert("presence_penalty".into(), v.into());
    }
    if let Some(v) = req.seed {
        obj.insert("seed".into(), v.into());
    }
    if let Some(ref v) = req.grammar {
        obj.insert("grammar".into(), v.clone().into());
    }
    if let Some(v) = req.min_p {
        obj.insert("min_p".into(), v.into());
    }
    if let Some(v) = req.typical_p {
        obj.insert("typical_p".into(), v.into());
    }
    if let Some(v) = req.mirostat {
        obj.insert("mirostat".into(), v.into());
    }
    if let Some(v) = req.mirostat_tau {
        obj.insert("mirostat_tau".into(), v.into());
    }
    if let Some(v) = req.mirostat_eta {
        obj.insert("mirostat_eta".into(), v.into());
    }
    if let Some(v) = req.tfs_z {
        obj.insert("tfs_z".into(), v.into());
    }

    let client = reqwest::Client::new();
    let response = client.post(&url).json(&body).send().await.map_err(|e| {
        AppError::Internal(anyhow::anyhow!("Failed to connect to llama.cpp: {}", e))
    })?;

    // Propagate any error status from llama.cpp as a 502 so the frontend can
    // surface a meaningful message rather than receiving a silent empty stream.
    if !response.status().is_success() {
        let status_code = response.status();
        let body_text = response.text().await.unwrap_or_default();
        let err_msg = serde_json::from_str::<serde_json::Value>(&body_text)
            .ok()
            .and_then(|v| {
                v.get("error")
                    .and_then(|e| e.as_str())
                    .map(String::from)
            })
            .unwrap_or_else(|| format!("llama.cpp returned status {status_code}"));
        tracing::error!(status = %status_code, body = %body_text, "llama.cpp completions error");
        return Err(AppError::UpstreamError(err_msg));
    }

    let byte_stream = response.bytes_stream();

    use futures::StreamExt;

    // llama.cpp sends SSE-formatted lines: "data: {...}\n\n"
    // We need to parse each line, extract the JSON, and re-emit as proper Axum SSE events.
    let event_stream = byte_stream
        .map(|chunk| match chunk {
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
                            events.push(Ok(Event::default().data(data)));
                        }
                    }
                }

                futures::stream::iter(events)
            }
            Err(e) => {
                let err_event = Event::default().data(format!("{{\"error\": \"{}\"}}", e));
                futures::stream::iter(vec![Ok(err_event)])
            }
        })
        .flatten();

    Ok(event_stream)
}

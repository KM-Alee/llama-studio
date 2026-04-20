use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;
use tokio::time::timeout;

use crate::services::config_store::ConfigStore;
use crate::services::runtime_tools;

const INSPECTION_READ_TIMEOUT: Duration = Duration::from_secs(3);
const MAX_CAPTURE_LINES: usize = 160;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetadataEntry {
    pub key: String,
    pub value_type: Option<String>,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInspection {
    pub binary: String,
    pub command: String,
    pub inspected_at: String,
    pub file_format: Option<String>,
    pub file_type: Option<String>,
    pub file_size: Option<String>,
    pub architecture: Option<String>,
    pub general_name: Option<String>,
    pub context_length: Option<u32>,
    pub model_type: Option<String>,
    pub model_params: Option<String>,
    pub n_layer: Option<u32>,
    pub n_head: Option<u32>,
    pub n_embd: Option<u32>,
    pub vocab_size: Option<u32>,
    pub metadata: Vec<ModelMetadataEntry>,
    pub raw_output: Vec<String>,
    pub warnings: Vec<String>,
}

pub struct ModelInspector {
    config: Arc<ConfigStore>,
}

impl ModelInspector {
    pub fn new(config: Arc<ConfigStore>) -> Self {
        Self { config }
    }

    pub async fn inspect(&self, model_path: &Path) -> Result<ModelInspection> {
        let config = self.config.get_all().await?;
        let binary = runtime_tools::command_for_llama_cli(&config.llama_cpp_path);
        let command = format!(
            "{} -v -m {} -n 0 -p '' -c 0 -ngl 0 --no-perf",
            binary.display(),
            model_path.display()
        );

        let mut child = Command::new(&binary);
        child
            .arg("-v")
            .arg("-m")
            .arg(model_path)
            .arg("-n")
            .arg("0")
            .arg("-p")
            .arg("")
            .arg("-c")
            .arg("0")
            .arg("-ngl")
            .arg("0")
            .arg("--no-perf")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = child
            .spawn()
            .map_err(|error| anyhow!("Failed to run {}: {}", binary.display(), error))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("Missing stdout pipe"))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| anyhow!("Missing stderr pipe"))?;

        let (tx, mut rx) = mpsc::channel(256);
        let stdout_task = tokio::spawn(read_lines(stdout, tx.clone()));
        let stderr_task = tokio::spawn(read_lines(stderr, tx.clone()));
        drop(tx);

        let mut inspection = ModelInspection {
            binary: binary.display().to_string(),
            command,
            inspected_at: chrono::Utc::now().to_rfc3339(),
            file_format: None,
            file_type: None,
            file_size: None,
            architecture: None,
            general_name: None,
            context_length: None,
            model_type: None,
            model_params: None,
            n_layer: None,
            n_head: None,
            n_embd: None,
            vocab_size: None,
            metadata: Vec::new(),
            raw_output: Vec::new(),
            warnings: Vec::new(),
        };

        loop {
            match timeout(INSPECTION_READ_TIMEOUT, rx.recv()).await {
                Ok(Some(line)) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }

                    if inspection.raw_output.len() < MAX_CAPTURE_LINES {
                        inspection.raw_output.push(trimmed.to_string());
                    }

                    parse_line(trimmed, &mut inspection);

                    if should_stop(trimmed, &inspection) {
                        break;
                    }
                }
                Ok(None) => break,
                Err(_) => {
                    inspection.warnings.push(
                        "llama.cpp inspection timed out; showing partial metadata.".to_string(),
                    );
                    break;
                }
            }
        }

        let _ = child.kill().await;
        let _ = child.wait().await;
        let _ = stdout_task.await;
        let _ = stderr_task.await;

        if inspection.architecture.is_none() && inspection.metadata.is_empty() {
            return Err(anyhow!("llama.cpp did not return parsable metadata"));
        }

        Ok(inspection)
    }
}

async fn read_lines<R>(reader: R, tx: mpsc::Sender<String>) -> Result<()>
where
    R: tokio::io::AsyncRead + Unpin,
{
    let mut lines = BufReader::new(reader).lines();
    while let Some(line) = lines.next_line().await? {
        if tx.send(line).await.is_err() {
            break;
        }
    }
    Ok(())
}

fn parse_line(line: &str, inspection: &mut ModelInspection) {
    if let Some((key, value_type, value)) = parse_metadata_line(line) {
        if key == "general.architecture" && inspection.architecture.is_none() {
            inspection.architecture = Some(value.clone());
        }
        if key == "general.name" && inspection.general_name.is_none() {
            inspection.general_name = Some(value.clone());
        }
        if key.ends_with(".context_length") && inspection.context_length.is_none() {
            inspection.context_length = value.parse::<u32>().ok();
        }
        inspection.metadata.push(ModelMetadataEntry {
            key,
            value_type,
            value,
        });
        return;
    }

    if let Some((key, value)) = parse_print_info_line(line) {
        match key.as_str() {
            "file format" => inspection.file_format = Some(value),
            "file type" => inspection.file_type = Some(value),
            "file size" => inspection.file_size = Some(value),
            "arch" => inspection.architecture = Some(value),
            "general.name" => inspection.general_name = Some(value),
            "n_ctx_train" => inspection.context_length = value.parse::<u32>().ok(),
            "model type" => inspection.model_type = Some(value),
            "model params" => inspection.model_params = Some(value),
            "n_layer" => inspection.n_layer = value.parse::<u32>().ok(),
            "n_head" => inspection.n_head = value.parse::<u32>().ok(),
            "n_embd" => inspection.n_embd = value.parse::<u32>().ok(),
            "n_vocab" => inspection.vocab_size = value.parse::<u32>().ok(),
            _ => {}
        }
    }
}

fn parse_metadata_line(line: &str) -> Option<(String, Option<String>, String)> {
    if !line.starts_with("llama_model_loader: - kv") {
        return None;
    }

    let (left, value) = line.split_once('=')?;
    let tokens: Vec<&str> = left.split_whitespace().collect();
    if tokens.len() < 2 {
        return None;
    }

    let key = tokens.get(tokens.len().saturating_sub(2))?.to_string();
    let value_type = tokens.last().map(|token| (*token).to_string());
    Some((key, value_type, value.trim().to_string()))
}

fn parse_print_info_line(line: &str) -> Option<(String, String)> {
    if !line.starts_with("print_info:") {
        return None;
    }

    let trimmed = line.trim_start_matches("print_info:").trim();
    let (key, value) = trimmed.split_once('=')?;
    Some((key.trim().to_string(), value.trim().to_string()))
}

fn should_stop(line: &str, inspection: &ModelInspection) -> bool {
    if inspection.raw_output.len() >= MAX_CAPTURE_LINES {
        return true;
    }

    if line.starts_with("load_tensors:") {
        return true;
    }

    inspection.file_type.is_some()
        && inspection.architecture.is_some()
        && inspection.context_length.is_some()
        && inspection.model_type.is_some()
        && inspection.model_params.is_some()
        && line.starts_with("print_info: max token length")
}

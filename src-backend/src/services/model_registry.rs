use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::db::Database;
use crate::services::config_store::ConfigStore;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Model {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub quantization: Option<String>,
    pub architecture: Option<String>,
    pub parameters: Option<String>,
    pub context_length: Option<u32>,
    pub added_at: String,
    pub last_used: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConversationSummary {
    pub id: String,
    pub title: String,
    pub updated_at: String,
    pub message_count: u32,
    pub assistant_messages: u32,
    pub attachment_count: u32,
    pub total_tokens: u64,
    pub total_generation_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelAnalytics {
    pub model_id: String,
    pub conversation_count: u32,
    pub message_count: u32,
    pub assistant_message_count: u32,
    pub attachment_count: u32,
    pub total_tokens: u64,
    pub avg_tokens_per_response: Option<f64>,
    pub total_generation_time_ms: u64,
    pub avg_generation_time_ms: Option<f64>,
    pub tokens_per_second: Option<f64>,
    pub last_used: Option<String>,
    pub context_length: Option<u32>,
    pub recent_conversations: Vec<ModelConversationSummary>,
}

pub struct ModelRegistry {
    db: Arc<Database>,
    config: Arc<ConfigStore>,
}

impl ModelRegistry {
    pub fn new(db: Arc<Database>, config: Arc<ConfigStore>) -> Self {
        Self { db, config }
    }

    pub async fn list(&self) -> Result<Vec<Model>> {
        self.db.list_models().await
    }

    pub async fn scan(&self) -> Result<usize> {
        let models_dir = self.config.get_models_dir().await;
        let root = std::path::PathBuf::from(&models_dir);

        if !root.exists() {
            return Ok(0);
        }

        let mut count = 0;
        // BFS walk so we don't need a recursive async fn or extra crate.
        let mut dirs_to_visit = std::collections::VecDeque::new();
        dirs_to_visit.push_back(root);

        while let Some(dir) = dirs_to_visit.pop_front() {
            let mut entries = match tokio::fs::read_dir(&dir).await {
                Ok(e) => e,
                Err(e) => {
                    tracing::warn!(dir = %dir.display(), err = %e, "Skipping unreadable directory");
                    continue;
                }
            };

            while let Some(entry) = entries.next_entry().await? {
                let file_path = entry.path();
                let metadata = entry.metadata().await?;

                if metadata.is_dir() {
                    dirs_to_visit.push_back(file_path);
                    continue;
                }

                if file_path.extension().is_some_and(|ext| ext == "gguf") {
                    let path_str = file_path.to_string_lossy().to_string();

                    if self
                        .db
                        .model_exists_by_path(&path_str)
                        .await
                        .unwrap_or(false)
                    {
                        continue;
                    }

                    let name = file_path
                        .file_stem()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default();

                    let model = Model {
                        id: uuid::Uuid::new_v4().to_string(),
                        name,
                        path: path_str,
                        size_bytes: metadata.len(),
                        quantization: Self::detect_quantization(&file_path),
                        architecture: None,
                        parameters: None,
                        context_length: None,
                        added_at: chrono::Utc::now().to_rfc3339(),
                        last_used: None,
                    };

                    self.db.upsert_model(&model).await?;
                    count += 1;
                }
            }
        }

        Ok(count)
    }

    pub async fn get(&self, id: &str) -> Result<Model> {
        self.db.get_model(id).await
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        self.db.delete_model(id).await
    }

    fn detect_quantization(path: &std::path::Path) -> Option<String> {
        Self::detect_quant(path)
    }

    /// Detect quantization type from a GGUF filename.
    pub fn detect_quant(path: &std::path::Path) -> Option<String> {
        let name = path.file_stem()?.to_string_lossy().to_uppercase();
        let quants = [
            "Q2_K", "Q3_K_S", "Q3_K_M", "Q3_K_L", "Q4_0", "Q4_K_S", "Q4_K_M", "Q5_0", "Q5_K_S",
            "Q5_K_M", "Q6_K", "Q8_0", "F16", "F32", "IQ1_S", "IQ2_XXS", "IQ2_XS", "IQ3_XXS",
            "IQ3_S", "IQ4_NL", "IQ4_XS",
        ];
        for q in &quants {
            if name.contains(q) {
                return Some(q.to_string());
            }
        }
        None
    }
}

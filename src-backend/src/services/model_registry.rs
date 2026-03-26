use std::sync::Arc;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;

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
        let path = std::path::Path::new(&models_dir);

        if !path.exists() {
            return Ok(0);
        }

        let mut count = 0;
        let mut entries = tokio::fs::read_dir(path).await?;
        while let Some(entry) = entries.next_entry().await? {
            let file_path = entry.path();
            if file_path.extension().is_some_and(|ext| ext == "gguf") {
                let metadata = entry.metadata().await?;
                let name = file_path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();

                let model = Model {
                    id: uuid::Uuid::new_v4().to_string(),
                    name,
                    path: file_path.to_string_lossy().to_string(),
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

        Ok(count)
    }

    pub async fn get(&self, id: &str) -> Result<Model> {
        self.db.get_model(id).await
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        self.db.delete_model(id).await
    }

    fn detect_quantization(path: &std::path::Path) -> Option<String> {
        let name = path.file_stem()?.to_string_lossy().to_uppercase();
        let quants = ["Q2_K", "Q3_K_S", "Q3_K_M", "Q3_K_L", "Q4_0", "Q4_K_S", "Q4_K_M",
                       "Q5_0", "Q5_K_S", "Q5_K_M", "Q6_K", "Q8_0", "F16", "F32",
                       "IQ1_S", "IQ2_XXS", "IQ2_XS", "IQ3_XXS", "IQ3_S", "IQ4_NL", "IQ4_XS"];
        for q in &quants {
            if name.contains(q) {
                return Some(q.to_string());
            }
        }
        None
    }
}

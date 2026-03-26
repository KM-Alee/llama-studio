use std::sync::Arc;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::db::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub llama_cpp_path: String,
    pub models_directory: String,
    pub default_profile: String,
    pub theme: String,
    pub llama_server_port: u16,
    pub app_port: u16,
    pub gpu_layers: i32,
    pub context_size: u32,
    pub threads: u32,
    pub flash_attention: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            llama_cpp_path: String::new(),
            models_directory: dirs::home_dir()
                .map(|h| h.join("models").to_string_lossy().to_string())
                .unwrap_or_default(),
            default_profile: "normal".to_string(),
            theme: "system".to_string(),
            llama_server_port: 8080,
            app_port: 3000,
            gpu_layers: -1,
            context_size: 4096,
            threads: 0, // 0 = auto-detect
            flash_attention: true,
        }
    }
}

pub struct ConfigStore {
    db: Arc<Database>,
    config: tokio::sync::RwLock<AppConfig>,
}

impl ConfigStore {
    pub async fn new(db: Arc<Database>) -> Result<Self> {
        let config = Self::load_from_db(&db).await.unwrap_or_default();
        Ok(Self {
            db,
            config: tokio::sync::RwLock::new(config),
        })
    }

    async fn load_from_db(db: &Database) -> Result<AppConfig> {
        let json = db.get_config().await?;
        Ok(serde_json::from_value(json)?)
    }

    pub async fn get_all(&self) -> Result<AppConfig> {
        Ok(self.config.read().await.clone())
    }

    pub async fn update(&self, updates: Value) -> Result<AppConfig> {
        let mut config = self.config.write().await;
        // Merge updates into existing config
        let mut current = serde_json::to_value(&*config)?;
        if let (Some(current_obj), Some(updates_obj)) = (current.as_object_mut(), updates.as_object()) {
            for (key, value) in updates_obj {
                current_obj.insert(key.clone(), value.clone());
            }
        }
        *config = serde_json::from_value(current)?;
        self.db.set_config(&serde_json::to_value(&*config)?).await?;
        Ok(config.clone())
    }

    pub async fn get_llama_port(&self) -> u16 {
        self.config.read().await.llama_server_port
    }

    pub async fn get_models_dir(&self) -> String {
        self.config.read().await.models_directory.clone()
    }
}

use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

use crate::db::Database;

pub const DEFAULT_LLAMA_SERVER_PORT: u16 = 6970;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub llama_cpp_path: String,
    pub models_directory: String,
    pub default_profile: String,
    pub theme: String,
    pub llama_server_port: u16,
    pub gpu_layers: i32,
    pub context_size: u32,
    pub threads: u32,
    pub flash_attention: bool,
    pub batch_size: Option<u32>,
    pub ubatch_size: Option<u32>,
    pub rope_scaling: Option<String>,
    pub rope_freq_base: Option<f64>,
    pub rope_freq_scale: Option<f64>,
    pub mmap: Option<bool>,
    pub mlock: Option<bool>,
    pub cont_batching: Option<bool>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            llama_cpp_path: String::new(),
            models_directory: dirs::home_dir()
                .map(|h| h.join("models").to_string_lossy().to_string())
                .unwrap_or_default(),
            default_profile: "normal".to_string(),
            theme: "light".to_string(),
            llama_server_port: DEFAULT_LLAMA_SERVER_PORT,
            gpu_layers: -1,
            context_size: 4096,
            threads: 0, // 0 = auto-detect
            flash_attention: true,
            batch_size: None,
            ubatch_size: None,
            rope_scaling: None,
            rope_freq_base: None,
            rope_freq_scale: None,
            mmap: None,
            mlock: None,
            cont_batching: Some(true),
        }
    }
}

pub struct ConfigStore {
    db: Arc<Database>,
    config: tokio::sync::RwLock<AppConfig>,
}

impl ConfigStore {
    pub async fn new(db: Arc<Database>) -> Result<Self> {
        let config = Self::load_from_db(&db).await?;
        let store = Self {
            db,
            config: tokio::sync::RwLock::new(config),
        };
        // Persist defaults so the config table is never empty.
        store.persist().await?;
        Ok(store)
    }

    async fn load_from_db(db: &Database) -> Result<AppConfig> {
        let json = db.get_config().await?;
        if json.as_object().is_some_and(|o| o.is_empty()) {
            // No config stored yet — use defaults.
            return Ok(AppConfig::default());
        }
        // Merge stored values on top of defaults so new fields keep their defaults.
        let mut base = serde_json::to_value(AppConfig::default())?;
        if let (Some(base_obj), Some(stored_obj)) = (base.as_object_mut(), json.as_object()) {
            for (key, value) in stored_obj {
                base_obj.insert(key.clone(), value.clone());
            }
        }
        Ok(serde_json::from_value(base)?)
    }

    async fn persist(&self) -> Result<()> {
        let config = self.config.read().await;
        self.db.set_config(&serde_json::to_value(&*config)?).await
    }

    pub async fn get_all(&self) -> Result<AppConfig> {
        Ok(self.config.read().await.clone())
    }

    /// Validate a candidate config; returns a descriptive error on failure.
    fn validate(cfg: &AppConfig) -> Result<()> {
        if cfg.llama_server_port < 1024 {
            anyhow::bail!("llama_server_port must be >= 1024");
        }
        if cfg.models_directory.is_empty() {
            anyhow::bail!("models_directory must not be empty");
        }
        if cfg.context_size == 0 {
            anyhow::bail!("context_size must be > 0");
        }
        Ok(())
    }

    /// Merge `updates` into the current config, validate, and persist.
    pub async fn update(&self, updates: Value) -> Result<AppConfig> {
        let mut config = self.config.write().await;
        let mut current = serde_json::to_value(&*config)?;
        if let (Some(current_obj), Some(updates_obj)) =
            (current.as_object_mut(), updates.as_object())
        {
            for (key, value) in updates_obj {
                current_obj.insert(key.clone(), value.clone());
            }
        }
        let candidate: AppConfig = serde_json::from_value(current)?;
        Self::validate(&candidate)?;
        *config = candidate;
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

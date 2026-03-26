use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::db::Database;
use crate::services::config_store::ConfigStore;
use crate::services::download_manager::DownloadManager;
use crate::services::llama_process::LlamaProcessManager;
use crate::services::model_registry::ModelRegistry;
use crate::services::preset_manager::PresetManager;
use crate::services::session_manager::SessionManager;

/// Shared application state accessible from all route handlers.
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Database>,
    pub llama: Arc<RwLock<LlamaProcessManager>>,
    pub models: Arc<ModelRegistry>,
    pub sessions: Arc<SessionManager>,
    pub config: Arc<ConfigStore>,
    pub presets: Arc<PresetManager>,
    pub downloads: Arc<DownloadManager>,
}

impl AppState {
    pub async fn new() -> Result<Self> {
        let db = Arc::new(Database::new().await?);
        let config = Arc::new(ConfigStore::new(db.clone()).await?);
        let llama = Arc::new(RwLock::new(LlamaProcessManager::new(config.clone(), db.clone())));
        let models = Arc::new(ModelRegistry::new(db.clone(), config.clone()));
        let sessions = Arc::new(SessionManager::new(db.clone()));
        let presets = Arc::new(PresetManager::new(db.clone()).await?);
        let downloads = Arc::new(DownloadManager::new(config.clone()));

        Ok(Self {
            db,
            llama,
            models,
            sessions,
            config,
            presets,
            downloads,
        })
    }
}

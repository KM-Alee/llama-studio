use serde_json::Value;
use tracing::debug;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Legacy keys sometimes still present in old clients or stored JSON; they are ignored.
const OBSOLETE_CONFIG_KEYS: &[&str] = &["app_port"];

fn strip_obsolete_config_keys(updates: &mut Value) {
    let Some(obj) = updates.as_object_mut() else {
        return;
    };
    for &key in OBSOLETE_CONFIG_KEYS {
        if obj.remove(key).is_some() {
            debug!(obsolete_key = %key, "dropped obsolete config field from update payload");
        }
    }
}

pub async fn get_config(state: &AppState) -> AppResult<Value> {
    let config = state.config.get_all().await?;
    serde_json::to_value(config).map_err(|e| AppError::Internal(anyhow::anyhow!(e)))
}

pub async fn update_config(state: &AppState, mut updates: Value) -> AppResult<Value> {
    strip_obsolete_config_keys(&mut updates);
    let config = state
        .config
        .update(updates)
        .await
        .map_err(|e| AppError::BadRequest(e.to_string()))?;
    serde_json::to_value(config).map_err(|e| AppError::Internal(anyhow::anyhow!(e)))
}

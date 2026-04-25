use serde_json::{Value, json};

use crate::error::AppResult;
use crate::state::AppState;

pub async fn list_presets(state: &AppState) -> AppResult<Value> {
    let presets = state.presets.list().await?;
    Ok(json!({ "presets": presets }))
}

pub async fn create_preset(state: &AppState, req: Value) -> AppResult<Value> {
    let preset = state.presets.create(req).await?;
    Ok(json!(preset))
}

pub async fn get_preset(state: &AppState, id: &str) -> AppResult<Value> {
    let preset = state.presets.get(id).await?;
    Ok(json!(preset))
}

pub async fn update_preset(state: &AppState, id: &str, req: Value) -> AppResult<Value> {
    let preset = state.presets.update(id, req).await?;
    Ok(json!(preset))
}

pub async fn delete_preset(state: &AppState, id: &str) -> AppResult<Value> {
    state.presets.delete(id).await?;
    Ok(json!({ "deleted": true }))
}

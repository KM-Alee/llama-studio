use serde::Deserialize;
use serde_json::{Value, json};
use std::path::Path;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub async fn list_models(state: &AppState) -> AppResult<Value> {
    let models = state.models.list().await?;
    Ok(json!({ "models": models }))
}

pub async fn scan_models(state: &AppState) -> AppResult<Value> {
    let count = state.models.scan().await?;
    Ok(json!({ "scanned": count }))
}

#[derive(Deserialize)]
pub struct ImportModelRequest {
    pub path: String,
}

pub async fn import_model(state: &AppState, body: ImportModelRequest) -> AppResult<Value> {
    let source = Path::new(&body.path);
    if !source.exists() {
        return Err(AppError::BadRequest(format!(
            "File not found: {}",
            body.path
        )));
    }
    if source.extension().and_then(|e| e.to_str()) != Some("gguf") {
        return Err(AppError::BadRequest(
            "Only .gguf files are supported".into(),
        ));
    }

    let canonical = source
        .canonicalize()
        .map_err(|e| AppError::BadRequest(format!("Invalid path: {}", e)))?;
    let path_str = canonical.to_string_lossy().to_string();

    if state
        .db
        .model_exists_by_path(&path_str)
        .await
        .unwrap_or(false)
    {
        return Err(AppError::BadRequest("Model already imported".into()));
    }

    let metadata = tokio::fs::metadata(&canonical)
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Cannot read file: {}", e)))?;

    let name = canonical
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    let model = crate::services::model_registry::Model {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        path: path_str,
        size_bytes: metadata.len(),
        quantization: crate::services::model_registry::ModelRegistry::detect_quant(&canonical),
        architecture: None,
        parameters: None,
        context_length: None,
        added_at: chrono::Utc::now().to_rfc3339(),
        last_used: None,
    };

    state.db.upsert_model(&model).await?;
    Ok(json!(model))
}

pub async fn get_model(state: &AppState, id: &str) -> AppResult<Value> {
    let model = state.models.get(id).await?;
    Ok(json!(model))
}

pub async fn inspect_model(state: &AppState, id: &str) -> AppResult<Value> {
    let mut model = state.models.get(id).await?;
    let inspection = state
        .inspector
        .inspect(Path::new(&model.path))
        .await
        .map_err(AppError::Internal)?;

    if model.architecture.as_deref() != inspection.architecture.as_deref() {
        model.architecture = inspection.architecture.clone();
    }
    if model.parameters.as_deref() != inspection.model_params.as_deref() {
        model.parameters = inspection.model_params.clone();
    }
    if model.context_length != inspection.context_length {
        model.context_length = inspection.context_length;
    }
    if model.quantization.is_none() {
        model.quantization = inspection
            .file_type
            .as_ref()
            .map(|value| value.split(" - ").next().unwrap_or(value).to_string());
    }

    state
        .db
        .upsert_model(&model)
        .await
        .map_err(AppError::Internal)?;

    Ok(json!({
        "model": model,
        "inspection": inspection,
    }))
}

pub async fn get_model_analytics(state: &AppState, id: &str) -> AppResult<Value> {
    let analytics = state
        .db
        .get_model_analytics(id)
        .await
        .map_err(AppError::Internal)?;
    Ok(json!({ "analytics": analytics }))
}

pub async fn delete_model(state: &AppState, id: &str) -> AppResult<Value> {
    state.models.delete(id).await?;
    Ok(json!({ "deleted": true }))
}

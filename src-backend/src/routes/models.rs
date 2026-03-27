use axum::{
    Router,
    extract::State,
    routing::{get, post},
    Json,
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_models))
        .route("/scan", post(scan_models))
        .route("/import", post(import_model))
    .route("/{id}/inspect", get(inspect_model))
    .route("/{id}/analytics", get(get_model_analytics))
        .route("/{id}", get(get_model).delete(delete_model))
}

async fn list_models(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let models = state.models.list().await?;
    Ok(Json(json!({ "models": models })))
}

async fn scan_models(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let count = state.models.scan().await?;
    Ok(Json(json!({ "scanned": count })))
}

#[derive(Deserialize)]
struct ImportRequest {
    path: String,
}

/// Import a model by copying or symlinking from a given filesystem path.
async fn import_model(
    State(state): State<AppState>,
    Json(body): Json<ImportRequest>,
) -> AppResult<Json<Value>> {
    let source = std::path::Path::new(&body.path);
    if !source.exists() {
        return Err(AppError::BadRequest(format!("File not found: {}", body.path)));
    }
    if source.extension().and_then(|e| e.to_str()) != Some("gguf") {
        return Err(AppError::BadRequest("Only .gguf files are supported".into()));
    }

    // Prevent path traversal — resolve to canonical path
    let canonical = source.canonicalize()
        .map_err(|e| AppError::BadRequest(format!("Invalid path: {}", e)))?;
    let path_str = canonical.to_string_lossy().to_string();

    // Check if model is already registered
    if state.db.model_exists_by_path(&path_str).await.unwrap_or(false) {
        return Err(AppError::BadRequest("Model already imported".into()));
    }

    let metadata = tokio::fs::metadata(&canonical).await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Cannot read file: {}", e)))?;

    let name = canonical.file_stem()
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
    Ok(Json(json!(model)))
}

async fn get_model(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> AppResult<Json<Value>> {
    let model = state.models.get(&id).await?;
    Ok(Json(json!(model)))
}

async fn inspect_model(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> AppResult<Json<Value>> {
    let mut model = state.models.get(&id).await?;
    let inspection = state.inspector.inspect(std::path::Path::new(&model.path)).await
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

    state.db.upsert_model(&model).await.map_err(AppError::Internal)?;

    Ok(Json(json!({
        "model": model,
        "inspection": inspection,
    })))
}

async fn get_model_analytics(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> AppResult<Json<Value>> {
    let analytics = state.db.get_model_analytics(&id).await
        .map_err(AppError::Internal)?;
    Ok(Json(json!({ "analytics": analytics })))
}

async fn delete_model(
    State(state): State<AppState>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> AppResult<Json<Value>> {
    state.models.delete(&id).await?;
    Ok(Json(json!({ "deleted": true })))
}

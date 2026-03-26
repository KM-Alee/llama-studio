use axum::{
    Router,
    extract::Query,
    routing::get,
    Json,
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/search", get(search_models))
}

#[derive(Deserialize)]
struct SearchQuery {
    q: String,
    #[serde(default = "default_limit")]
    limit: u32,
}

fn default_limit() -> u32 {
    20
}

/// Search HuggingFace for GGUF models matching a query.
async fn search_models(Query(params): Query<SearchQuery>) -> AppResult<Json<Value>> {
    let limit = params.limit.min(50);
    let url = format!(
        "https://huggingface.co/api/models?search={}&filter=gguf&sort=downloads&direction=-1&limit={}",
        urlencoding::encode(&params.q),
        limit
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("HTTP client error: {}", e)))?;

    let response = client.get(&url)
        .header("User-Agent", "AI-Studio/0.1")
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("HuggingFace API error: {}", e)))?;

    if !response.status().is_success() {
        return Err(AppError::Internal(anyhow::anyhow!(
            "HuggingFace returned status {}",
            response.status()
        )));
    }

    let models: Vec<Value> = response.json().await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to parse HF response: {}", e)))?;

    // Extract relevant fields for each model
    let results: Vec<Value> = models.iter().map(|m| {
        json!({
            "id": m.get("id").and_then(|v| v.as_str()).unwrap_or(""),
            "author": m.get("author").and_then(|v| v.as_str()).unwrap_or(""),
            "downloads": m.get("downloads").and_then(|v| v.as_u64()).unwrap_or(0),
            "likes": m.get("likes").and_then(|v| v.as_u64()).unwrap_or(0),
            "tags": m.get("tags").unwrap_or(&json!([])),
            "last_modified": m.get("lastModified").and_then(|v| v.as_str()).unwrap_or(""),
        })
    }).collect();

    Ok(Json(json!({ "models": results })))
}

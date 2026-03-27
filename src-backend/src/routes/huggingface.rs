use axum::{Json, Router, extract::Query, routing::get};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/search", get(search_models))
        .route("/model-files/{*repo_id}", get(get_model_files))
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

/// Fetch GGUF file listing for a HuggingFace model repository.
async fn get_model_files(
    axum::extract::Path(repo_id): axum::extract::Path<String>,
) -> AppResult<Json<Value>> {
    let url = format!("https://huggingface.co/api/models/{}?blobs=true", repo_id);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| AppError::Internal(anyhow::anyhow!("HTTP client error: {}", e)))?;

    let response = client
        .get(&url)
        .header("User-Agent", "Llama-Studio/0.1")
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("HuggingFace API error: {}", e)))?;

    if !response.status().is_success() {
        return Err(AppError::Internal(anyhow::anyhow!(
            "HuggingFace returned status {}",
            response.status()
        )));
    }

    let model: Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to parse HF response: {}", e)))?;

    let mut files: Vec<Value> = model
        .get("siblings")
        .and_then(|s| s.as_array())
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|sibling| {
            let filename = sibling.get("rfilename")?.as_str()?;
            if !filename.ends_with(".gguf") {
                return None;
            }
            let size = sibling
                .get("size")
                .and_then(|v| v.as_u64())
                .or_else(|| {
                    sibling
                        .get("lfs")
                        .and_then(|value| value.get("size"))
                        .and_then(|v| v.as_u64())
                })
                .unwrap_or(0);
            Some(json!({ "filename": filename, "size": size }))
        })
        .collect();

    files.sort_by(|left, right| {
        let left_size = left
            .get("size")
            .and_then(|value| value.as_u64())
            .unwrap_or(0);
        let right_size = right
            .get("size")
            .and_then(|value| value.as_u64())
            .unwrap_or(0);
        right_size.cmp(&left_size)
    });

    let total_size_bytes: u64 = files
        .iter()
        .filter_map(|file| file.get("size").and_then(|value| value.as_u64()))
        .sum();

    Ok(Json(json!({
        "repo_id": repo_id,
        "files": files,
        "gguf_count": files.len(),
        "total_size_bytes": total_size_bytes,
    })))
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

    let response = client
        .get(&url)
        .header("User-Agent", "Llama-Studio/0.1")
        .send()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("HuggingFace API error: {}", e)))?;

    if !response.status().is_success() {
        return Err(AppError::Internal(anyhow::anyhow!(
            "HuggingFace returned status {}",
            response.status()
        )));
    }

    let models: Vec<Value> = response
        .json()
        .await
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to parse HF response: {}", e)))?;

    // Extract relevant fields for each model
    let results: Vec<Value> = models
        .iter()
        .map(|m| {
            let id = m.get("id").and_then(|v| v.as_str()).unwrap_or("");
            json!({
                "id": id,
                "name": id.rsplit('/').next().unwrap_or(id),
                "author": m.get("author").and_then(|v| v.as_str()).unwrap_or(""),
                "downloads": m.get("downloads").and_then(|v| v.as_u64()).unwrap_or(0),
                "likes": m.get("likes").and_then(|v| v.as_u64()).unwrap_or(0),
                "tags": m.get("tags").unwrap_or(&json!([])),
                "last_modified": m.get("lastModified").and_then(|v| v.as_str()).unwrap_or(""),
            })
        })
        .collect();

    Ok(Json(json!({ "models": results })))
}

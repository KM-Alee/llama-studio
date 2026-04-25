use axum::{Json, Router, extract::Query, routing::get};
use serde::Deserialize;
use serde_json::Value;

use crate::app_core::huggingface;
use crate::error::AppResult;
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

async fn get_model_files(
    axum::extract::Path(repo_id): axum::extract::Path<String>,
) -> AppResult<Json<Value>> {
    Ok(Json(huggingface::get_model_files(&repo_id).await?))
}

async fn search_models(Query(params): Query<SearchQuery>) -> AppResult<Json<Value>> {
    Ok(Json(
        huggingface::search_models(&params.q, params.limit).await?,
    ))
}

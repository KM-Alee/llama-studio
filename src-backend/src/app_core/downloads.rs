use serde::Deserialize;
use serde_json::{Value, json};
use url::Url;

use crate::error::{AppError, AppResult};
use crate::state::AppState;

pub async fn list_downloads(state: &AppState) -> AppResult<Value> {
    let downloads = state.downloads.list().await;
    Ok(json!({ "downloads": downloads }))
}

#[derive(Deserialize)]
pub struct StartDownloadRequest {
    pub url: String,
    pub filename: String,
}

pub async fn start_download(state: &AppState, body: StartDownloadRequest) -> AppResult<Value> {
    if body.filename.contains('/') || body.filename.contains('\\') || body.filename.contains("..") {
        return Err(AppError::BadRequest("Invalid filename".into()));
    }
    if !body.filename.ends_with(".gguf") {
        return Err(AppError::BadRequest("Filename must end with .gguf".into()));
    }

    let url_parsed =
        Url::parse(&body.url).map_err(|_| AppError::BadRequest("Invalid URL".into()))?;

    match url_parsed.scheme() {
        "https" => {}
        "http" => {
            let host = url_parsed.host_str().unwrap_or("");
            if !host.ends_with("huggingface.co") {
                return Err(AppError::BadRequest(
                    "Only HTTPS URLs are allowed (except huggingface.co)".into(),
                ));
            }
        }
        _ => return Err(AppError::BadRequest("Only HTTP(S) URLs are allowed".into())),
    }

    if let Some(host) = url_parsed.host_str() {
        let blocked = [
            "localhost",
            "127.0.0.1",
            "0.0.0.0",
            "::1",
            "169.254.169.254",
        ];
        if blocked.contains(&host)
            || host.starts_with("10.")
            || host.starts_with("192.168.")
            || host.starts_with("172.")
        {
            return Err(AppError::BadRequest(
                "Internal network addresses are not allowed".into(),
            ));
        }
    }

    let id = state
        .downloads
        .start_download(body.url, body.filename)
        .await
        .map_err(AppError::Internal)?;

    Ok(json!({ "id": id }))
}

pub async fn cancel_download(state: &AppState, id: &str) -> AppResult<Value> {
    state
        .downloads
        .cancel(id)
        .await
        .map_err(AppError::Internal)?;
    Ok(json!({ "cancelled": true }))
}

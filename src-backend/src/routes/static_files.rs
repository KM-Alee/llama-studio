use axum::{
    http::{StatusCode, Uri},
    response::{Html, IntoResponse, Response},
};

#[cfg(debug_assertions)]
use axum::{body::Body, http::header::CONTENT_TYPE};

#[cfg(debug_assertions)]
const VITE_DEV_SERVER: &str = "http://127.0.0.1:6767";

#[cfg(debug_assertions)]
async fn proxy_vite_request(uri: &Uri) -> Response {
    let path_and_query = uri
        .path_and_query()
        .map(|value| value.as_str())
        .unwrap_or_else(|| uri.path());
    let target = format!("{VITE_DEV_SERVER}{path_and_query}");

    match reqwest::get(&target).await {
        Ok(response) => {
            let status = response.status();
            let content_type = response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|value| value.to_str().ok())
                .map(ToOwned::to_owned);

            match response.bytes().await {
                Ok(body) => {
                    let mut proxied = Response::builder().status(status);

                    if let Some(content_type) = content_type {
                        proxied = proxied.header(CONTENT_TYPE, content_type);
                    }

                    match proxied.body(Body::from(body)) {
                        Ok(response) => response,
                        Err(_) => (
                            StatusCode::BAD_GATEWAY,
                            "Failed to proxy frontend asset from Vite dev server",
                        )
                            .into_response(),
                    }
                }
                Err(error) => (
                    StatusCode::BAD_GATEWAY,
                    format!("Failed to read Vite dev server response: {error}"),
                )
                    .into_response(),
            }
        }
        Err(error) => Html(format!(
            r#"<!DOCTYPE html>
<html>
<head><title>LlamaStudio - Dev Mode</title></head>
<body>
<h1>LlamaStudio Backend Running</h1>
<p>Vite dev server was not reachable at <a href="{VITE_DEV_SERVER}">{VITE_DEV_SERVER}</a>.</p>
<pre>{error}</pre>
</body>
</html>"#
        ))
        .into_response(),
    }
}

/// In development: proxy to Vite dev server or return 404.
/// In production: serve embedded SPA files via rust-embed.
pub async fn serve_spa(uri: Uri) -> Response {
    #[cfg(debug_assertions)]
    {
        if uri.path().starts_with("/api/") {
            return (StatusCode::NOT_FOUND, "API route not found").into_response();
        }
        proxy_vite_request(&uri).await
    }

    #[cfg(not(debug_assertions))]
    {
        use rust_embed::RustEmbed;

        #[derive(RustEmbed)]
        #[folder = "../src-frontend/dist"]
        struct FrontendAssets;

        let path = uri.path().trim_start_matches('/');
        let path = if path.is_empty() { "index.html" } else { path };

        match FrontendAssets::get(path) {
            Some(content) => {
                let mime = mime_guess::from_path(path).first_or_octet_stream();
                (
                    [(axum::http::header::CONTENT_TYPE, mime.as_ref())],
                    content.data.to_vec(),
                )
                    .into_response()
            }
            None => {
                // SPA fallback: serve index.html for client-side routing
                match FrontendAssets::get("index.html") {
                    Some(content) => Html(
                        std::str::from_utf8(&content.data)
                            .unwrap_or_default()
                            .to_string(),
                    )
                    .into_response(),
                    None => (StatusCode::NOT_FOUND, "Not found").into_response(),
                }
            }
        }
    }
}

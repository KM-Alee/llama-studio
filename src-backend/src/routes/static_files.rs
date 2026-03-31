use axum::{
    http::{StatusCode, Uri},
    response::{Html, IntoResponse, Response},
};

/// In development: proxy to Vite dev server or return 404.
/// In production: serve embedded SPA files via rust-embed.
pub async fn serve_spa(uri: Uri) -> Response {
    // In development mode, return a simple message pointing to the Vite dev server
    #[cfg(debug_assertions)]
    {
        if uri.path().starts_with("/api/") {
            return (StatusCode::NOT_FOUND, "API route not found").into_response();
        }
        Html(
            r#"<!DOCTYPE html>
<html>
<head><title>Llama Studio - Dev Mode</title></head>
<body>
<h1>Llama Studio Backend Running</h1>
<p>Frontend is served by Vite dev server at <a href="http://localhost:5173">http://localhost:5173</a></p>
</body>
</html>"#,
        )
        .into_response()
    }

    // In release mode, serve embedded files
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

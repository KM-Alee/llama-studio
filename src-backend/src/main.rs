use anyhow::Result;
use axum::extract::DefaultBodyLimit;
use axum::http::HeaderValue;
use axum::{Router, routing::get};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

mod db;
mod error;
mod routes;
mod services;
mod state;

use state::AppState;

/// Maximum allowed HTTP request body: 32 MiB (covers large prompts and model imports).
const MAX_BODY_BYTES: usize = 32 * 1024 * 1024;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing.
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "ai_studio_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Initialize application state.
    let state = AppState::new().await?;

    // Read the configured application port; default is 3000.
    let app_port = state.config.get_app_port().await;

    // Build CORS origins for both localhost and 127.0.0.1 on the dev Vite port and app port.
    let cors_origins: Vec<HeaderValue> = [5173u16, app_port]
        .iter()
        .flat_map(|&port| {
            [
                format!("http://localhost:{}", port),
                format!("http://127.0.0.1:{}", port),
            ]
        })
        .filter_map(|s| s.parse().ok())
        .collect();

    // Build router.
    let app = Router::new()
        .route("/api/v1/health", get(routes::health::health_check))
        .nest("/api/v1/models", routes::models::router())
        .nest("/api/v1/server", routes::server::router())
        .nest("/api/v1/chat", routes::chat::router())
        .nest("/api/v1/conversations", routes::conversations::router())
        .nest("/api/v1/presets", routes::presets::router())
        .nest("/api/v1/config", routes::config::router())
        .nest("/api/v1/downloads", routes::downloads::router())
        .nest("/api/v1/huggingface", routes::huggingface::router())
        .nest("/api/v1/ws", routes::ws::router())
        .fallback(routes::static_files::serve_spa)
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(cors_origins)
                .allow_methods([
                    axum::http::Method::GET,
                    axum::http::Method::POST,
                    axum::http::Method::PUT,
                    axum::http::Method::DELETE,
                    axum::http::Method::OPTIONS,
                ])
                .allow_headers([axum::http::header::CONTENT_TYPE, axum::http::header::ACCEPT]),
        )
        .with_state(state.clone());

    // Bind to localhost only (security: never exposed to the network).
    let addr = SocketAddr::from(([127, 0, 0, 1], app_port));
    tracing::info!("Llama Studio starting on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    // Stop the managed llama.cpp subprocess before the process exits.
    let mut llama = state.llama.write().await;
    if let Err(e) = llama.stop().await {
        tracing::warn!(err = %e, "Error stopping llama.cpp during shutdown");
    }

    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install Ctrl+C handler");
    tracing::info!("Shutdown signal received, starting graceful shutdown...");
}

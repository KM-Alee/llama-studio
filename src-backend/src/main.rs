use anyhow::Result;
use axum::{
    Router,
    routing::get,
};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

mod db;
mod error;
mod routes;
mod services;
mod state;

use state::AppState;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "ai_studio_backend=debug,tower_http=debug".into()
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Initialize application state
    let state = AppState::new().await?;

    // Build router
    let app = Router::new()
        .route("/api/v1/health", get(routes::health::health_check))
        .nest("/api/v1/models", routes::models::router())
        .nest("/api/v1/server", routes::server::router())
        .nest("/api/v1/chat", routes::chat::router())
        .nest("/api/v1/conversations", routes::conversations::router())
        .nest("/api/v1/presets", routes::presets::router())
        .nest("/api/v1/config", routes::config::router())
        .nest("/api/v1/ws", routes::ws::router())
        .fallback(routes::static_files::serve_spa)
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    // Bind to localhost only (security: not exposed to network)
    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    tracing::info!("AI Studio starting on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to install Ctrl+C handler");
    tracing::info!("Shutdown signal received, starting graceful shutdown...");
}

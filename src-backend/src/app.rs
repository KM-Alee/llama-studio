use anyhow::Result;
use axum::extract::DefaultBodyLimit;
use axum::http::HeaderValue;
use axum::{Router, routing::get};
use std::future::Future;
use std::net::SocketAddr;
use std::sync::Once;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

use crate::routes;
use crate::state::AppState;

/// Maximum allowed HTTP request body: 32 MiB (covers large prompts and model imports).
const MAX_BODY_BYTES: usize = 32 * 1024 * 1024;
const DEV_FRONTEND_PORT: u16 = 6767;
/// Default bind port for the optional standalone HTTP server (`llamastudio-backend`).
const DEFAULT_HTTP_LISTEN_PORT: u16 = 6868;

/// TCP port for the **standalone** Axum server (CLI binary, browser against Vite proxy, CI).
/// The Tauri desktop build does not use this listener for UI I/O (it uses in-process IPC).
///
/// Environment variable `LLAMASTUDIO_APP_PORT` is a historical name from when the desktop
/// shell loaded the SPA over HTTP; it now only affects [`AppRuntime`] / `llamastudio-backend`.
fn http_listen_port() -> u16 {
    std::env::var("LLAMASTUDIO_APP_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .filter(|&p| p >= 1024)
        .unwrap_or(DEFAULT_HTTP_LISTEN_PORT)
}

/// Reusable server runtime used by the CLI backend and the Tauri shell.
pub struct AppRuntime {
    state: AppState,
    addr: SocketAddr,
    listener: tokio::net::TcpListener,
    router: Router,
}

impl AppRuntime {
    pub async fn new() -> Result<Self> {
        let state = AppState::new().await?;
        let listen_port = http_listen_port();
        let addr = SocketAddr::from(([127, 0, 0, 1], listen_port));
        let listener = tokio::net::TcpListener::bind(addr).await?;
        let router = build_router(state.clone(), listen_port);

        Ok(Self {
            state,
            addr,
            listener,
            router,
        })
    }

    pub fn addr(&self) -> SocketAddr {
        self.addr
    }

    pub fn state(&self) -> AppState {
        self.state.clone()
    }

    pub async fn run<F>(self, shutdown_signal: F) -> Result<()>
    where
        F: Future<Output = ()> + Send + 'static,
    {
        let Self {
            state,
            addr,
            listener,
            router,
        } = self;

        tracing::info!(address = %addr, "LlamaStudio starting on {}", addr);

        axum::serve(listener, router)
            .with_graceful_shutdown(shutdown_signal)
            .await?;

        stop_llama(&state).await;
        Ok(())
    }
}

pub fn init_tracing() {
    static TRACING_INIT: Once = Once::new();

    TRACING_INIT.call_once(|| {
        tracing_subscriber::registry()
            .with(
                EnvFilter::try_from_default_env()
                    .unwrap_or_else(|_| "llamastudio_backend=debug,tower_http=debug".into()),
            )
            .with(tracing_subscriber::fmt::layer())
            .init();
    });
}

pub async fn stop_llama(state: &AppState) {
    let mut llama = state.llama.write().await;
    if let Err(error) = llama.stop().await {
        tracing::warn!(error = %error, "Error stopping llama.cpp during shutdown");
    }
}

pub async fn shutdown_signal() {
    use tokio::signal;

    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received SIGINT, starting graceful shutdown...");
        }
        _ = terminate => {
            tracing::info!("Received SIGTERM, starting graceful shutdown...");
        }
    }
}

/// Full HTTP API router (used by [`AppRuntime`] and integration tests).
pub fn build_router(state: AppState, http_listen_port: u16) -> Router {
    let cors_origins: Vec<HeaderValue> = [DEV_FRONTEND_PORT, http_listen_port]
        .iter()
        .flat_map(|&port| {
            [
                format!("http://localhost:{port}"),
                format!("http://127.0.0.1:{port}"),
            ]
        })
        .filter_map(|origin| origin.parse().ok())
        .collect();

    Router::new()
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
        .with_state(state)
}

// Rust guideline compliant 2026-02-21

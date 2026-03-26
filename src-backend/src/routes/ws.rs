use axum::{
    Router,
    extract::{
        State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
    routing::get,
};
use futures::{SinkExt, StreamExt};
use serde_json::json;
use std::time::Duration;

use crate::state::AppState;

/// Register the WebSocket route.
pub fn router() -> Router<AppState> {
    Router::new().route("/", get(ws_handler))
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

/// Handle a WebSocket connection.
///
/// Sends periodic server-status heartbeats and listens for client commands.
async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();

    // Spawn a task that pushes server status every 2 seconds.
    let status_state = state.clone();
    let mut status_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(2));
        loop {
            interval.tick().await;
            let (status, model) = {
                let llama = status_state.llama.read().await;
                (
                    llama.status_str().to_string(),
                    llama.current_model().map(String::from),
                )
            };

            let payload = json!({
                "type": "server_status",
                "status": status,
                "model": model,
            });

            if sender
                .send(Message::Text(payload.to_string().into()))
                .await
                .is_err()
            {
                break; // Client disconnected
            }
        }
    });

    // Listen for incoming client messages.
    let recv_state = state.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                        tracing::debug!(msg = %parsed, "WebSocket message received");
                        // Future: handle client commands (e.g., cancel stream)
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // If either task finishes, abort the other.
    tokio::select! {
        _ = &mut status_task => { recv_task.abort(); }
        _ = &mut recv_task => { status_task.abort(); }
    }

    tracing::debug!("WebSocket connection closed");
}

// Rust guideline compliant 2026-02-21

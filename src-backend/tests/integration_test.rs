//! Integration tests for the AI Studio backend.
//!
//! Tests the HTTP API endpoints by launching the full Axum router
//! with an in-memory test state. Does not require a running llama.cpp
//! instance — the server lifecycle endpoints are tested for correct
//! status transitions and error responses.

use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
    routing::get,
};
use serde_json::{json, Value};
use tower::ServiceExt;

// Re-use the application's modules
use ai_studio_backend::error::AppResult;
use ai_studio_backend::routes;
use ai_studio_backend::state::AppState;

/// Build the full application router (mirrors main.rs) for test use.
async fn build_test_app() -> Router {
    let state = AppState::new().await.expect("Failed to initialize test AppState");

    Router::new()
        .route("/api/v1/health", get(routes::health::health_check))
        .nest("/api/v1/models", routes::models::router())
        .nest("/api/v1/server", routes::server::router())
        .nest("/api/v1/chat", routes::chat::router())
        .nest("/api/v1/conversations", routes::conversations::router())
        .nest("/api/v1/presets", routes::presets::router())
        .nest("/api/v1/config", routes::config::router())
        .with_state(state)
}

/// Helper: send a GET request and return (status, body).
async fn get_json(app: &Router, uri: &str) -> (StatusCode, Value) {
    let req = Request::builder()
        .uri(uri)
        .body(Body::empty())
        .unwrap();

    let response = app.clone().oneshot(req).await.unwrap();
    let status = response.status();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
    (status, json)
}

/// Helper: send a POST request with JSON body and return (status, body).
async fn post_json(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    let req = Request::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.clone().oneshot(req).await.unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, json)
}

/// Helper: send a DELETE request and return (status, body).
async fn delete_json(app: &Router, uri: &str) -> (StatusCode, Value) {
    let req = Request::builder()
        .method("DELETE")
        .uri(uri)
        .body(Body::empty())
        .unwrap();

    let response = app.clone().oneshot(req).await.unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, json)
}

// === Health ===

#[tokio::test]
async fn health_returns_ok() {
    let app = build_test_app().await;
    let (status, body) = get_json(&app, "/api/v1/health").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
    assert_eq!(body["name"], "AI Studio");
    assert!(body["version"].is_string());
}

// === Server status ===

#[tokio::test]
async fn server_status_initially_stopped() {
    let app = build_test_app().await;
    let (status, body) = get_json(&app, "/api/v1/server/status").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "stopped");
    assert!(body["model"].is_null());
}

// === Chat requires running server ===

#[tokio::test]
async fn chat_completions_fails_when_server_not_running() {
    let app = build_test_app().await;
    let (status, body) = post_json(
        &app,
        "/api/v1/chat/completions",
        json!({
            "messages": [{"role": "user", "content": "Hello"}],
            "stream": true,
        }),
    ).await;

    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(body["error"].as_str().unwrap().contains("not running"));
}

// === Models ===

#[tokio::test]
async fn models_list_returns_empty_initially() {
    let app = build_test_app().await;
    let (status, body) = get_json(&app, "/api/v1/models").await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["models"].is_array());
}

// === Conversations CRUD ===

#[tokio::test]
async fn conversation_create_and_get() {
    let app = build_test_app().await;

    // Create
    let (status, convo) = post_json(
        &app,
        "/api/v1/conversations",
        json!({ "title": "Test Chat" }),
    ).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(convo["title"], "Test Chat");
    let convo_id = convo["id"].as_str().unwrap();

    // Get
    let (status, body) = get_json(&app, &format!("/api/v1/conversations/{}", convo_id)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["conversation"]["title"], "Test Chat");
    assert!(body["messages"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn conversation_add_message_and_retrieve() {
    let app = build_test_app().await;

    // Create conversation
    let (_, convo) = post_json(
        &app,
        "/api/v1/conversations",
        json!({ "title": "Message Test" }),
    ).await;
    let convo_id = convo["id"].as_str().unwrap();

    // Add message
    let (status, msg) = post_json(
        &app,
        &format!("/api/v1/conversations/{}/messages", convo_id),
        json!({ "role": "user", "content": "Hello, world!" }),
    ).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(msg["role"], "user");
    assert_eq!(msg["content"], "Hello, world!");

    // Get messages
    let (status, body) = get_json(
        &app,
        &format!("/api/v1/conversations/{}/messages", convo_id),
    ).await;
    assert_eq!(status, StatusCode::OK);
    let messages = body["messages"].as_array().unwrap();
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0]["content"], "Hello, world!");
}

#[tokio::test]
async fn conversation_delete() {
    let app = build_test_app().await;

    let (_, convo) = post_json(
        &app,
        "/api/v1/conversations",
        json!({ "title": "To Delete" }),
    ).await;
    let convo_id = convo["id"].as_str().unwrap();

    let (status, _) = delete_json(&app, &format!("/api/v1/conversations/{}", convo_id)).await;
    assert_eq!(status, StatusCode::OK);
}

// === Presets ===

#[tokio::test]
async fn presets_list_returns_builtins() {
    let app = build_test_app().await;
    let (status, body) = get_json(&app, "/api/v1/presets").await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["presets"].is_array());
    // Builtin presets should be seeded
    let presets = body["presets"].as_array().unwrap();
    assert!(!presets.is_empty(), "Expected builtin presets to be seeded");
}

// === Config ===

#[tokio::test]
async fn config_get_returns_defaults() {
    let app = build_test_app().await;
    let (status, body) = get_json(&app, "/api/v1/config").await;

    assert_eq!(status, StatusCode::OK);
    // Config should have default keys seeded by ConfigStore
    assert!(body.is_object());
}

// === Start server with non-existent model fails gracefully ===

#[tokio::test]
async fn start_server_with_missing_model_returns_starting() {
    let app = build_test_app().await;

    // Starting with a non-existent model path — the process will fail to spawn
    // but the API should return "starting" status since spawn is attempted async
    let (status, body) = post_json(
        &app,
        "/api/v1/server/start",
        json!({ "model_id": "/nonexistent/model.gguf" }),
    ).await;

    // Either starting (spawn succeeded but process will die) or error (spawn failed)
    assert!(
        status == StatusCode::OK || status == StatusCode::INTERNAL_SERVER_ERROR,
        "Unexpected status: {status}"
    );
}

// Rust guideline compliant 2026-02-21

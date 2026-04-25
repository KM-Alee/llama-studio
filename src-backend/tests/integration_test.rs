//! Integration tests for the LlamaStudio backend.
//!
//! Tests the HTTP API endpoints by launching the full Axum router
//! with an in-memory test state. Does not require a running llama.cpp
//! instance — the server lifecycle endpoints are tested for correct
//! status transitions and error responses.

use axum::{Router, body::Body, http::Request, http::StatusCode};
use serde_json::{Value, json};
use tower::ServiceExt;

use llamastudio_backend::app;
use llamastudio_backend::state::AppState;

/// Build the full application router (same graph as [`app::build_router`] / production).
async fn build_test_app() -> Router {
    let state = AppState::new_in_memory()
        .await
        .expect("Failed to initialize test AppState");

    app::build_router(state, 6868)
}

/// Helper: send a GET request and return (status, body).
async fn get_json(app: &Router, uri: &str) -> (StatusCode, Value) {
    let req = Request::builder().uri(uri).body(Body::empty()).unwrap();

    let response = app.clone().oneshot(req).await.unwrap();
    let status = response.status();
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
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
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
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
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
    (status, json)
}

/// Helper: send a PUT request with JSON body and return (status, body).
async fn put_json(app: &Router, uri: &str, body: Value) -> (StatusCode, Value) {
    let req = Request::builder()
        .method("PUT")
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap();

    let response = app.clone().oneshot(req).await.unwrap();
    let status = response.status();
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
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
    assert_eq!(body["name"], "LlamaStudio");
    assert_eq!(body["version"], "0.1.0");
}

#[tokio::test]
async fn websocket_route_is_registered() {
    let app = build_test_app().await;
    let req = Request::builder().uri("/api/v1/ws").body(Body::empty()).unwrap();
    let response = app.clone().oneshot(req).await.unwrap();
    assert_ne!(
        response.status(),
        StatusCode::NOT_FOUND,
        "WS route should exist (plain GET may reject upgrade, but must not 404)"
    );
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
    )
    .await;

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
    )
    .await;
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
    )
    .await;
    let convo_id = convo["id"].as_str().unwrap();

    // Add message
    let (status, msg) = post_json(
        &app,
        &format!("/api/v1/conversations/{}/messages", convo_id),
        json!({ "role": "user", "content": "Hello, world!" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(msg["role"], "user");
    assert_eq!(msg["content"], "Hello, world!");

    // Get messages
    let (status, body) = get_json(
        &app,
        &format!("/api/v1/conversations/{}/messages", convo_id),
    )
    .await;
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
    )
    .await;
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
async fn start_server_with_missing_model_returns_not_found() {
    let app = build_test_app().await;

    let (status, _body) = post_json(
        &app,
        "/api/v1/server/start",
        json!({ "model_id": "/nonexistent/model.gguf" }),
    )
    .await;

    assert_eq!(status, StatusCode::NOT_FOUND);
}

// === Phase 4: Model Import ===

#[tokio::test]
async fn import_model_rejects_nonexistent_path() {
    let app = build_test_app().await;
    let (status, body) = post_json(
        &app,
        "/api/v1/models/import",
        json!({ "path": "/nonexistent/model.gguf" }),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(
        body["error"].as_str().unwrap().contains("not found")
            || body["error"].as_str().unwrap().contains("Not found")
            || body["error"].as_str().unwrap().contains("File not found")
    );
}

#[tokio::test]
async fn import_model_rejects_non_gguf_file() {
    // Create a temp file that isn't .gguf
    let tmp = std::env::temp_dir().join("test_import.txt");
    std::fs::write(&tmp, "test").unwrap();

    let app = build_test_app().await;
    let (status, body) = post_json(
        &app,
        "/api/v1/models/import",
        json!({ "path": tmp.to_string_lossy() }),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].as_str().unwrap().contains("gguf"));
    let _ = std::fs::remove_file(&tmp);
}

#[tokio::test]
async fn import_model_accepts_valid_gguf() {
    // Create a temp .gguf file with a unique name
    let unique = uuid::Uuid::new_v4().to_string();
    let tmp = std::env::temp_dir().join(format!("test_import_{}.gguf", unique));
    std::fs::write(&tmp, "fake-gguf-content").unwrap();

    let app = build_test_app().await;
    let (status, body) = post_json(
        &app,
        "/api/v1/models/import",
        json!({ "path": tmp.to_string_lossy() }),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["id"].is_string());
    let _ = std::fs::remove_file(&tmp);
}

// === Phase 4: Downloads ===

#[tokio::test]
async fn downloads_list_initially_empty() {
    let app = build_test_app().await;
    let (status, body) = get_json(&app, "/api/v1/downloads").await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["downloads"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn download_start_rejects_invalid_filename() {
    let app = build_test_app().await;
    let (status, body) = post_json(
        &app,
        "/api/v1/downloads/start",
        json!({ "url": "https://example.com/model.gguf", "filename": "../evil.gguf" }),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].as_str().unwrap().contains("Invalid"));
}

#[tokio::test]
async fn download_start_rejects_non_gguf_filename() {
    let app = build_test_app().await;
    let (status, body) = post_json(
        &app,
        "/api/v1/downloads/start",
        json!({ "url": "https://example.com/model.bin", "filename": "model.bin" }),
    )
    .await;

    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(body["error"].as_str().unwrap().contains("gguf"));
}

// === Phase 4: Config Update ===

#[tokio::test]
async fn config_update_and_read_back() {
    let app = build_test_app().await;

    let (status, _) = put_json(
        &app,
        "/api/v1/config",
        json!({ "context_size": 8192, "gpu_layers": 32 }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, body) = get_json(&app, "/api/v1/config").await;
    assert_eq!(status, StatusCode::OK);
    // The config store merges, so our values should be present
    assert!(body.is_object());
}

#[tokio::test]
async fn config_update_strips_obsolete_app_port() {
    let app = build_test_app().await;

    let (status, _) = put_json(
        &app,
        "/api/v1/config",
        json!({ "app_port": 9999, "context_size": 4097 }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    let (status, body) = get_json(&app, "/api/v1/config").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["context_size"], 4097);
    assert!(body.get("app_port").is_none());
}

// === Phase 5: Server Logs ===

#[tokio::test]
async fn server_logs_initially_empty() {
    let app = build_test_app().await;
    let (status, body) = get_json(&app, "/api/v1/server/logs").await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["logs"].is_array());
    assert!(body["logs"].as_array().unwrap().is_empty());
}

// === Phase 5: Custom CLI Flags ===

#[tokio::test]
async fn server_flags_get_initially_empty() {
    let app = build_test_app().await;
    let (status, body) = get_json(&app, "/api/v1/server/flags").await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["flags"].is_array());
    assert!(body["flags"].as_array().unwrap().is_empty());
}

#[tokio::test]
async fn server_flags_set_and_get() {
    let app = build_test_app().await;

    let (status, body) = put_json(
        &app,
        "/api/v1/server/flags",
        json!({ "flags": ["--mlock", "--no-mmap"] }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["flags"].as_array().unwrap().len(), 2);
}

// === Phase 5: Server Metrics ===

#[tokio::test]
async fn server_metrics_unavailable_when_stopped() {
    let app = build_test_app().await;
    let (status, body) = get_json(&app, "/api/v1/server/metrics").await;

    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["available"], false);
}

// === Phase 5: Hardware Detection ===

#[tokio::test]
async fn hardware_detection_returns_info() {
    let app = build_test_app().await;
    let (status, body) = get_json(&app, "/api/v1/server/hardware").await;

    assert_eq!(status, StatusCode::OK);
    assert!(body["hardware"].is_object());
    assert!(body["hardware"]["cpu_cores"].as_u64().unwrap() > 0);
}

// === Phase 5: Chat with parameters ===

#[tokio::test]
async fn chat_with_params_fails_when_server_not_running() {
    let app = build_test_app().await;
    let (status, body) = post_json(
        &app,
        "/api/v1/chat/completions",
        json!({
            "messages": [{"role": "user", "content": "Hello"}],
            "stream": true,
            "temperature": 0.5,
            "top_p": 0.9,
            "system_prompt": "You are helpful"
        }),
    )
    .await;

    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(body["error"].as_str().unwrap().contains("not running"));
}

// === Phase 6: Search Conversations ===

#[tokio::test]
async fn search_conversations_returns_results() {
    let app = build_test_app().await;

    // Create a conversation with known title
    let (_, convo) = post_json(
        &app,
        "/api/v1/conversations",
        json!({ "title": "Unique Quantum Physics Discussion" }),
    )
    .await;
    let convo_id = convo["id"].as_str().unwrap();

    // Add a message with searchable content
    post_json(
        &app,
        &format!("/api/v1/conversations/{}/messages", convo_id),
        json!({ "role": "user", "content": "Tell me about quantum entanglement" }),
    )
    .await;

    // Search by title
    let (status, body) = get_json(&app, "/api/v1/conversations/search?q=Quantum").await;
    assert_eq!(status, StatusCode::OK);
    let results = body["conversations"].as_array().unwrap();
    assert!(
        !results.is_empty(),
        "Expected to find conversation by title"
    );

    // Search by message content
    let (status, body) = get_json(&app, "/api/v1/conversations/search?q=entanglement").await;
    assert_eq!(status, StatusCode::OK);
    let results = body["conversations"].as_array().unwrap();
    assert!(
        !results.is_empty(),
        "Expected to find conversation by message content"
    );
}

#[tokio::test]
async fn search_conversations_empty_query() {
    let app = build_test_app().await;
    let (status, body) = get_json(&app, "/api/v1/conversations/search?q=xyznonexistent999").await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["conversations"].as_array().unwrap().is_empty());
}

// === Phase 6: Export ===

#[tokio::test]
async fn export_conversation_json() {
    let app = build_test_app().await;

    let (_, convo) = post_json(
        &app,
        "/api/v1/conversations",
        json!({ "title": "Export Test" }),
    )
    .await;
    let convo_id = convo["id"].as_str().unwrap();

    post_json(
        &app,
        &format!("/api/v1/conversations/{}/messages", convo_id),
        json!({ "role": "user", "content": "Hello export" }),
    )
    .await;

    let (status, body) = get_json(
        &app,
        &format!("/api/v1/conversations/{}/export/json", convo_id),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["conversation"]["title"], "Export Test");
    assert_eq!(body["messages"][0]["content"], "Hello export");
}

#[tokio::test]
async fn export_conversation_markdown() {
    let app = build_test_app().await;

    let (_, convo) = post_json(
        &app,
        "/api/v1/conversations",
        json!({ "title": "MD Export" }),
    )
    .await;
    let convo_id = convo["id"].as_str().unwrap();

    post_json(
        &app,
        &format!("/api/v1/conversations/{}/messages", convo_id),
        json!({ "role": "user", "content": "Markdown test content" }),
    )
    .await;

    // The markdown export returns a plain string, not JSON
    let req = Request::builder()
        .uri(&format!(
            "/api/v1/conversations/{}/export/markdown",
            convo_id
        ))
        .body(Body::empty())
        .unwrap();
    let response = app.clone().oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let md = String::from_utf8_lossy(&bytes);
    assert!(md.contains("# MD Export"));
    assert!(md.contains("Markdown test content"));
}

// === Phase 6: Fork Conversation ===

#[tokio::test]
async fn fork_conversation_copies_messages() {
    let app = build_test_app().await;

    let (_, convo) = post_json(
        &app,
        "/api/v1/conversations",
        json!({ "title": "Fork Source" }),
    )
    .await;
    let convo_id = convo["id"].as_str().unwrap();

    post_json(
        &app,
        &format!("/api/v1/conversations/{}/messages", convo_id),
        json!({ "role": "user", "content": "First message" }),
    )
    .await;

    post_json(
        &app,
        &format!("/api/v1/conversations/{}/messages", convo_id),
        json!({ "role": "assistant", "content": "Response" }),
    )
    .await;

    // Fork the conversation
    let (status, forked) = post_json(
        &app,
        &format!("/api/v1/conversations/{}/fork", convo_id),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(forked["title"].as_str().unwrap().contains("(fork)"));
    let forked_id = forked["id"].as_str().unwrap();

    // Verify the forked conversation has all messages
    let (status, body) = get_json(
        &app,
        &format!("/api/v1/conversations/{}/messages", forked_id),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let msgs = body["messages"].as_array().unwrap();
    assert_eq!(msgs.len(), 2);
    assert_eq!(msgs[0]["content"], "First message");
    assert_eq!(msgs[1]["content"], "Response");
}

// === Phase 7: Message Deletion ===

#[tokio::test]
async fn delete_message_removes_it_from_conversation() {
    let app = build_test_app().await;

    let (_, convo) = post_json(
        &app,
        "/api/v1/conversations",
        json!({ "title": "Msg Delete Test" }),
    )
    .await;
    let convo_id = convo["id"].as_str().unwrap();

    let (_, msg) = post_json(
        &app,
        &format!("/api/v1/conversations/{}/messages", convo_id),
        json!({ "role": "user", "content": "To be deleted" }),
    )
    .await;
    let msg_id = msg["id"].as_str().unwrap();

    // Delete the message via the dedicated endpoint.
    let (status, body) = delete_json(
        &app,
        &format!("/api/v1/conversations/{}/messages/{}", convo_id, msg_id),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["deleted"], true);

    // Verify the message is gone.
    let (status, body) = get_json(
        &app,
        &format!("/api/v1/conversations/{}/messages", convo_id),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let msgs = body["messages"].as_array().unwrap();
    assert!(msgs.is_empty(), "expected 0 messages, got {}", msgs.len());
}

// === Phase 8: Config Validation ===

#[tokio::test]
async fn config_rejects_invalid_llama_server_port() {
    let app = build_test_app().await;

    // Port 80 is below the 1024 threshold.
    let (status, body) = put_json(&app, "/api/v1/config", json!({ "llama_server_port": 80 })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(
        body["error"]
            .as_str()
            .unwrap_or("")
            .contains("llama_server_port"),
        "expected validation message about llama_server_port"
    );
}

#[tokio::test]
async fn config_rejects_zero_context_size() {
    let app = build_test_app().await;

    let (status, body) = put_json(&app, "/api/v1/config", json!({ "context_size": 0 })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(
        body["error"]
            .as_str()
            .unwrap_or("")
            .contains("context_size")
    );
}

#[tokio::test]
async fn config_rejects_empty_models_directory() {
    let app = build_test_app().await;

    let (status, body) = put_json(&app, "/api/v1/config", json!({ "models_directory": "" })).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(
        body["error"]
            .as_str()
            .unwrap_or("")
            .contains("models_directory")
    );
}

// === Phase 9: Recursive Model Scan ===

#[tokio::test]
async fn scan_models_handles_nonexistent_directory() {
    let app = build_test_app().await;

    // Update config to point to a directory that does not exist.
    let (status, _) = put_json(
        &app,
        "/api/v1/config",
        json!({ "models_directory": "/nonexistent/models/path/xyz" }),
    )
    .await;
    assert_eq!(status, StatusCode::OK);

    // Scan should return 0 rather than an error.
    let (status, body) = post_json(&app, "/api/v1/models/scan", json!({})).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["scanned"], 0);
}

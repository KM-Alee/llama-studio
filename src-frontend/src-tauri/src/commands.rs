//! Tauri IPC commands mapping to `llamastudio_backend::app_core`.

use futures_util::StreamExt;
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

use llamastudio_backend::app_core::chat::validate_chat_request;
use llamastudio_backend::app_core::chat_types::ChatRequest;
use llamastudio_backend::app_core::{
    chat, config, conversations, downloads, health, huggingface, models, presets, server, ui_prefs,
};
use llamastudio_backend::error::AppError;
use llamastudio_backend::services::llama_process;
use llamastudio_backend::state::AppState;

fn map_err(e: AppError) -> String {
    e.to_string()
}

#[derive(Clone)]
pub struct ActiveChatStreams(pub std::sync::Arc<dashmap::DashMap<String, tauri::async_runtime::JoinHandle<()>>>);

impl Default for ActiveChatStreams {
    fn default() -> Self {
        Self(std::sync::Arc::new(dashmap::DashMap::new()))
    }
}

#[tauri::command]
pub async fn get_health() -> Result<Value, String> {
    Ok(health::health_json())
}

#[tauri::command]
pub async fn list_models(state: State<'_, AppState>) -> Result<Value, String> {
    models::list_models(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn scan_models(state: State<'_, AppState>) -> Result<Value, String> {
    models::scan_models(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn import_model(state: State<'_, AppState>, path: String) -> Result<Value, String> {
    models::import_model(&state, models::ImportModelRequest { path })
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn delete_model(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    models::delete_model(&state, &id).await.map_err(map_err)
}

#[tauri::command]
pub async fn inspect_model(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    models::inspect_model(&state, &id).await.map_err(map_err)
}

#[tauri::command]
pub async fn get_model_analytics(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    models::get_model_analytics(&state, &id).await.map_err(map_err)
}

#[tauri::command]
pub async fn start_server(
    state: State<'_, AppState>,
    model_id: String,
    extra_args: Vec<String>,
) -> Result<Value, String> {
    server::start_server(
        &state,
        server::StartServerRequest {
            model_id,
            extra_args,
        },
    )
    .await
    .map_err(map_err)
}

#[tauri::command]
pub async fn stop_server(state: State<'_, AppState>) -> Result<Value, String> {
    server::stop_server(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn get_server_status(state: State<'_, AppState>) -> Result<Value, String> {
    server::server_status(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn get_server_logs(state: State<'_, AppState>) -> Result<Value, String> {
    server::get_logs(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn get_server_flags(state: State<'_, AppState>) -> Result<Value, String> {
    server::get_flags(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn set_server_flags(state: State<'_, AppState>, flags: Vec<String>) -> Result<Value, String> {
    server::set_flags(&state, flags).await.map_err(map_err)
}

#[tauri::command]
pub async fn get_dependency_status(state: State<'_, AppState>) -> Result<Value, String> {
    server::get_dependencies(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn get_server_metrics(state: State<'_, AppState>) -> Result<Value, String> {
    server::get_metrics(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn detect_hardware(state: State<'_, AppState>) -> Result<Value, String> {
    server::detect_hardware(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn start_chat_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    active: State<'_, ActiveChatStreams>,
    req: ChatRequest,
) -> Result<String, String> {
    validate_chat_request(&req).map_err(map_err)?;
    let request_id = Uuid::new_v4().to_string();

    let app_handle = app.clone();
    let state_inner = state.inner().clone();
    let rid = request_id.clone();
    let active_map = active.0.clone();

    let handle = tauri::async_runtime::spawn(async move {
        let outcome = async {
            let port = chat::assert_llama_running(&state_inner).await.map_err(map_err)?;
            let mut stream = llama_process::create_chat_stream_data_strings(port, req)
                .await
                .map_err(map_err)?;
            while let Some(data) = stream.next().await {
                let _ = app_handle.emit(
                    "chat://chunk",
                    json!({ "request_id": rid, "data": data }),
                );
            }
            Ok::<(), String>(())
        }
        .await;

        if let Err(message) = outcome {
            let _ = app_handle.emit(
                "chat://error",
                json!({ "request_id": rid, "message": message }),
            );
        }
        let _ = app_handle.emit("chat://done", json!({ "request_id": rid }));
        active_map.remove(&rid);
    });

    active.0.insert(request_id.clone(), handle);

    Ok(request_id)
}

#[tauri::command]
pub async fn cancel_chat_stream(
    active: State<'_, ActiveChatStreams>,
    request_id: String,
) -> Result<(), String> {
    if let Some((_id, handle)) = active.0.remove(&request_id) {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
pub async fn list_conversations(state: State<'_, AppState>) -> Result<Value, String> {
    conversations::list_conversations(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn create_conversation(
    state: State<'_, AppState>,
    body: conversations::CreateConversation,
) -> Result<Value, String> {
    conversations::create_conversation(&state, body)
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn get_conversation(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    conversations::get_conversation(&state, &id).await.map_err(map_err)
}

#[tauri::command]
pub async fn delete_conversation(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    conversations::delete_conversation(&state, &id).await.map_err(map_err)
}

#[tauri::command]
pub async fn search_conversations(state: State<'_, AppState>, q: String) -> Result<Value, String> {
    conversations::search_conversations(&state, &q).await.map_err(map_err)
}

#[tauri::command]
pub async fn export_conversation_json(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    conversations::export_json(&state, &id).await.map_err(map_err)
}

#[tauri::command]
pub async fn export_conversation_markdown(state: State<'_, AppState>, id: String) -> Result<String, String> {
    conversations::export_markdown(&state, &id).await.map_err(map_err)
}

#[tauri::command]
pub async fn fork_conversation(
    state: State<'_, AppState>,
    id: String,
    after_message_id: Option<String>,
) -> Result<Value, String> {
    conversations::fork_conversation(
        &state,
        &id,
        conversations::ForkRequest {
            after_message_id,
        },
    )
    .await
    .map_err(map_err)
}

#[tauri::command]
pub async fn update_conversation(
    state: State<'_, AppState>,
    id: String,
    body: Value,
) -> Result<Value, String> {
    conversations::update_conversation(&state, &id, body)
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn get_messages(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    conversations::get_messages(&state, &id).await.map_err(map_err)
}

#[tauri::command]
pub async fn add_message(
    state: State<'_, AppState>,
    id: String,
    body: conversations::AddMessage,
) -> Result<Value, String> {
    conversations::add_message(&state, &id, body).await.map_err(map_err)
}

#[tauri::command]
pub async fn delete_message(
    state: State<'_, AppState>,
    conversation_id: String,
    message_id: String,
) -> Result<Value, String> {
    conversations::delete_message(&state, &conversation_id, &message_id)
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn get_presets(state: State<'_, AppState>) -> Result<Value, String> {
    presets::list_presets(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn create_preset(state: State<'_, AppState>, body: Value) -> Result<Value, String> {
    presets::create_preset(&state, body).await.map_err(map_err)
}

#[tauri::command]
pub async fn delete_preset(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    presets::delete_preset(&state, &id).await.map_err(map_err)
}

#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> Result<Value, String> {
    config::get_config(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn update_config(state: State<'_, AppState>, body: Value) -> Result<Value, String> {
    config::update_config(&state, body).await.map_err(map_err)
}

#[tauri::command]
pub async fn list_downloads(state: State<'_, AppState>) -> Result<Value, String> {
    downloads::list_downloads(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn start_download(
    state: State<'_, AppState>,
    url: String,
    filename: String,
) -> Result<Value, String> {
    downloads::start_download(&state, downloads::StartDownloadRequest { url, filename })
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn cancel_download(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    downloads::cancel_download(&state, &id).await.map_err(map_err)
}

#[tauri::command]
pub async fn search_huggingface(q: String, limit: Option<u32>) -> Result<Value, String> {
    huggingface::search_models(&q, limit.unwrap_or(20))
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn get_huggingface_files(repo_id: String) -> Result<Value, String> {
    huggingface::get_model_files(&repo_id).await.map_err(map_err)
}

#[tauri::command]
pub async fn get_ui_preferences(state: State<'_, AppState>) -> Result<Value, String> {
    ui_prefs::get_ui_preferences(&state).await.map_err(map_err)
}

#[tauri::command]
pub async fn set_ui_preferences(
    state: State<'_, AppState>,
    app_prefs: Option<Value>,
    custom_templates: Option<Value>,
) -> Result<Value, String> {
    ui_prefs::set_ui_preferences(&state, app_prefs, custom_templates)
        .await
        .map_err(map_err)
}

#[tauri::command]
pub async fn merge_browser_ui_migration(
    state: State<'_, AppState>,
    app_prefs: Option<Value>,
    custom_templates: Option<Value>,
) -> Result<Value, String> {
    let (existing_app, existing_templates) = state
        .db
        .get_desktop_ui_state()
        .await
        .map_err(|e| e.to_string())?;
    let app_next = if let Some(p) = app_prefs {
        if p.as_object().is_some_and(|o| !o.is_empty()) {
            let mut base = existing_app.as_object().cloned().unwrap_or_default();
            if let Some(obj) = p.as_object() {
                for (k, v) in obj {
                    base.insert(k.clone(), v.clone());
                }
            }
            Value::Object(base)
        } else {
            existing_app
        }
    } else {
        existing_app
    };
    let templates_next = if let Some(t) = custom_templates {
        if t.as_array().is_some_and(|a| !a.is_empty()) {
            t
        } else {
            existing_templates
        }
    } else {
        existing_templates
    };
    state
        .db
        .set_desktop_ui_app_prefs(&app_next)
        .await
        .map_err(|e| e.to_string())?;
    state
        .db
        .set_desktop_ui_custom_templates(&templates_next)
        .await
        .map_err(|e| e.to_string())?;
    ui_prefs::get_ui_preferences(&state).await.map_err(map_err)
}

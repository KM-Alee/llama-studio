mod commands;

use std::time::Duration;

use commands::ActiveChatStreams;
use llamastudio_backend::app::init_tracing;
use llamastudio_backend::app::stop_llama;
use llamastudio_backend::state::AppState;
use serde_json::json;
use tauri::{Emitter, Manager, WebviewUrl, WindowEvent, webview::WebviewWindowBuilder};
use tauri_plugin_updater::Builder as UpdaterPluginBuilder;
use tokio::sync::broadcast::error::RecvError;

fn spawn_server_events(app: tauri::AppHandle, state: AppState) {
    tauri::async_runtime::spawn(async move {
        let mut log_rx = {
            let llama = state.llama.read().await;
            llama.subscribe_logs()
        };
        let mut interval = tokio::time::interval(Duration::from_secs(2));
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    let (status, model) = {
                        let llama = state.llama.read().await;
                        (
                            llama.status_str().to_string(),
                            llama.current_model().map(String::from),
                        )
                    };
                    let _ = app.emit(
                        "server://status",
                        json!({
                            "type": "server_status",
                            "status": status,
                            "model": model,
                        }),
                    );
                }
                recv = log_rx.recv() => {
                    match recv {
                        Ok(entry) => {
                            let _ = app.emit(
                                "server://log",
                                json!({
                                    "type": "log",
                                    "timestamp": entry.timestamp,
                                    "line": entry.line,
                                }),
                            );
                        }
                        Err(RecvError::Lagged(_)) => {}
                        Err(RecvError::Closed) => break,
                    }
                }
            }
        }
    });
}

fn spawn_download_events(app: tauri::AppHandle, state: AppState) {
    tauri::async_runtime::spawn(async move {
        let mut rx = state.downloads.subscribe();
        loop {
            match rx.recv().await {
                Ok(progress) => {
                    let _ = app.emit("downloads://progress", progress);
                }
                Err(RecvError::Lagged(_)) => {}
                Err(RecvError::Closed) => break,
            }
        }
    });
}

fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    if window.label() != "main" {
        return;
    }

    if matches!(event, WindowEvent::CloseRequested { .. }) {
        if let Some(state) = window.app_handle().try_state::<AppState>() {
            let app_state = state.inner().clone();
            tauri::async_runtime::block_on(stop_llama(&app_state));
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_tracing();

    let app_state = tauri::async_runtime::block_on(AppState::new())
        .unwrap_or_else(|error| panic!("failed to initialize LlamaStudio app state: {error}"));

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(UpdaterPluginBuilder::new().build())
        .manage(app_state.clone())
        .manage(ActiveChatStreams::default())
        .invoke_handler(tauri::generate_handler![
            commands::get_health,
            commands::list_models,
            commands::scan_models,
            commands::import_model,
            commands::delete_model,
            commands::inspect_model,
            commands::get_model_analytics,
            commands::start_server,
            commands::stop_server,
            commands::get_server_status,
            commands::get_server_logs,
            commands::get_server_flags,
            commands::set_server_flags,
            commands::get_dependency_status,
            commands::get_server_metrics,
            commands::detect_hardware,
            commands::start_chat_stream,
            commands::cancel_chat_stream,
            commands::list_conversations,
            commands::create_conversation,
            commands::get_conversation,
            commands::delete_conversation,
            commands::search_conversations,
            commands::export_conversation_json,
            commands::export_conversation_markdown,
            commands::fork_conversation,
            commands::update_conversation,
            commands::get_messages,
            commands::add_message,
            commands::delete_message,
            commands::get_presets,
            commands::create_preset,
            commands::delete_preset,
            commands::get_config,
            commands::update_config,
            commands::list_downloads,
            commands::start_download,
            commands::cancel_download,
            commands::search_huggingface,
            commands::get_huggingface_files,
            commands::get_ui_preferences,
            commands::set_ui_preferences,
            commands::merge_browser_ui_migration,
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            spawn_server_events(handle.clone(), app_state.clone());
            spawn_download_events(handle, app_state.clone());

            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("LlamaStudio")
                .inner_size(1440.0, 960.0)
                .min_inner_size(1100.0, 720.0)
                .build()?;

            Ok(())
        })
        .on_window_event(handle_window_event)
        .run(tauri::generate_context!())
        .expect("error while running LlamaStudio desktop");
}

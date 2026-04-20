use llamastudio_backend::app::{AppRuntime, init_tracing, stop_llama};
use llamastudio_backend::state::AppState;
use std::sync::Mutex;
use tauri::{Manager, WebviewUrl, WindowEvent, webview::WebviewWindowBuilder};
use tauri_plugin_updater::Builder as UpdaterPluginBuilder;
use tokio::sync::oneshot;
use url::Url;

struct DesktopState {
    app_state: AppState,
    shutdown_tx: Mutex<Option<oneshot::Sender<()>>>,
}

impl DesktopState {
    fn new(app_state: AppState, shutdown_tx: oneshot::Sender<()>) -> Self {
        Self {
            app_state,
            shutdown_tx: Mutex::new(Some(shutdown_tx)),
        }
    }

    fn stop_backend(&self) {
        if let Some(shutdown_tx) = self.shutdown_tx.lock().unwrap().take() {
            let _ = shutdown_tx.send(());
        }

        let app_state = self.app_state.clone();
        tauri::async_runtime::block_on(async move {
            stop_llama(&app_state).await;
        });
    }
}

fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    if window.label() != "main" {
        return;
    }

    if matches!(event, WindowEvent::CloseRequested { .. }) {
        let state = window.app_handle().state::<DesktopState>();
        state.stop_backend();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_tracing();

    let runtime = tauri::async_runtime::block_on(AppRuntime::new())
        .unwrap_or_else(|error| panic!("failed to initialize LlamaStudio backend: {error}"));
    let port = runtime.addr().port();
    let server_url =
        Url::parse(&format!("http://localhost:{port}")).expect("invalid LlamaStudio localhost URL");
    let app_state = runtime.state();
    let (shutdown_tx, shutdown_rx) = oneshot::channel();

    tauri::Builder::default()
        .plugin(tauri_plugin_localhost::Builder::new(port).build())
        .plugin(tauri_plugin_process::init())
        .plugin(UpdaterPluginBuilder::new().build())
        .setup(move |app| {
            app.manage(DesktopState::new(app_state.clone(), shutdown_tx));

            tauri::async_runtime::spawn(async move {
                if let Err(error) = runtime
                    .run(async move {
                        let _ = shutdown_rx.await;
                    })
                    .await
                {
                    tracing::error!(error = %error, "LlamaStudio backend exited");
                }
            });

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(server_url.clone()))
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

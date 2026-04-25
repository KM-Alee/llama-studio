//! Transport-neutral application logic shared by the HTTP server (standalone/dev),
//! integration tests, and the Tauri desktop shell.

pub mod chat;
pub mod chat_types;
pub mod config;
pub mod conversations;
pub mod downloads;
pub mod health;
pub mod huggingface;
pub mod models;
pub mod presets;
pub mod server;
pub mod ui_prefs;

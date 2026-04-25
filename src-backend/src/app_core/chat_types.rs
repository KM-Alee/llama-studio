//! Shared chat completion request types (used by HTTP routes, app core, and llama.cpp proxy).

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<ChatMessage>,
    #[allow(dead_code)]
    #[serde(default = "default_stream")]
    pub stream: bool,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub top_k: Option<i32>,
    pub repeat_penalty: Option<f64>,
    pub max_tokens: Option<i32>,
    pub stop: Option<Vec<String>>,
    pub frequency_penalty: Option<f64>,
    pub presence_penalty: Option<f64>,
    pub seed: Option<i64>,
    pub grammar: Option<String>,
    pub system_prompt: Option<String>,
    pub min_p: Option<f64>,
    pub typical_p: Option<f64>,
    pub mirostat: Option<i32>,
    pub mirostat_tau: Option<f64>,
    pub mirostat_eta: Option<f64>,
    pub tfs_z: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

fn default_stream() -> bool {
    true
}

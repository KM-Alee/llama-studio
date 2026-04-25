use serde::Deserialize;
use serde_json::{Value, json};

use crate::error::{AppError, AppResult};
use crate::services::session_manager::MessageAttachment;
use crate::state::AppState;

#[derive(Deserialize)]
pub struct CreateConversation {
    pub title: Option<String>,
    pub model_id: Option<String>,
    pub preset_id: Option<String>,
    pub system_prompt: Option<String>,
}

#[derive(Deserialize)]
pub struct AddMessage {
    pub role: String,
    pub content: String,
    pub attachments: Option<Vec<MessageAttachment>>,
    pub tokens_used: Option<u32>,
    pub generation_time_ms: Option<u64>,
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Deserialize)]
pub struct ForkRequest {
    pub after_message_id: Option<String>,
}

pub async fn list_conversations(state: &AppState) -> AppResult<Value> {
    let convos = state.sessions.list().await?;
    Ok(json!({ "conversations": convos }))
}

pub async fn create_conversation(state: &AppState, req: CreateConversation) -> AppResult<Value> {
    let convo = state.sessions.create(req).await?;
    Ok(json!(convo))
}

pub async fn get_conversation(state: &AppState, id: &str) -> AppResult<Value> {
    let convo = state.sessions.get(id).await?;
    Ok(json!(convo))
}

pub async fn update_conversation(state: &AppState, id: &str, req: Value) -> AppResult<Value> {
    let convo = state.sessions.update(id, req).await?;
    Ok(json!(convo))
}

pub async fn delete_conversation(state: &AppState, id: &str) -> AppResult<Value> {
    state.sessions.delete(id).await?;
    Ok(json!({ "deleted": true }))
}

pub async fn get_messages(state: &AppState, id: &str) -> AppResult<Value> {
    let messages = state.sessions.get_messages(id).await?;
    Ok(json!({ "messages": messages }))
}

pub async fn add_message(state: &AppState, id: &str, req: AddMessage) -> AppResult<Value> {
    let msg = state.sessions.add_message(id, req).await?;
    Ok(json!(msg))
}

pub async fn search_conversations(state: &AppState, q: &str) -> AppResult<Value> {
    let results = state
        .db
        .search_conversations(q)
        .await
        .map_err(AppError::Internal)?;
    Ok(json!({ "conversations": results }))
}

pub async fn export_json(state: &AppState, id: &str) -> AppResult<Value> {
    let convo_data = state.sessions.get(id).await.map_err(AppError::Internal)?;
    Ok(convo_data)
}

pub async fn export_markdown(state: &AppState, id: &str) -> AppResult<String> {
    let convo_data = state.sessions.get(id).await.map_err(AppError::Internal)?;

    let title = convo_data["conversation"]["title"]
        .as_str()
        .unwrap_or("Chat");
    let mut md = format!("# {}\n\n", title);

    if let Some(system) = convo_data["conversation"]["system_prompt"].as_str()
        && !system.is_empty()
    {
        md.push_str(&format!("**System:** {}\n\n---\n\n", system));
    }

    if let Some(messages) = convo_data["messages"].as_array() {
        for msg in messages {
            let role = msg["role"].as_str().unwrap_or("unknown");
            let content = msg["content"].as_str().unwrap_or("");
            let label = match role {
                "user" => "**User**",
                "assistant" => "**Assistant**",
                "system" => "**System**",
                _ => "**Unknown**",
            };
            md.push_str(&format!("{}\n\n{}\n\n---\n\n", label, content));
        }
    }

    Ok(md)
}

pub async fn fork_conversation(state: &AppState, id: &str, req: ForkRequest) -> AppResult<Value> {
    let forked = state
        .sessions
        .fork(id, req.after_message_id.as_deref())
        .await
        .map_err(AppError::Internal)?;
    Ok(json!(forked))
}

pub async fn delete_message(state: &AppState, id: &str, msg_id: &str) -> AppResult<Value> {
    state
        .sessions
        .delete_message(id, msg_id)
        .await
        .map_err(AppError::Internal)?;
    Ok(json!({ "deleted": true }))
}

use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::error::{AppError, AppResult};
use crate::services::session_manager::MessageAttachment;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_conversations).post(create_conversation))
        .route("/search", get(search_conversations))
        .route(
            "/{id}",
            get(get_conversation)
                .put(update_conversation)
                .delete(delete_conversation),
        )
        .route("/{id}/messages", get(get_messages).post(add_message))
        .route(
            "/{id}/messages/{msg_id}",
            axum::routing::delete(delete_message_handler),
        )
        .route("/{id}/export/json", get(export_json))
        .route("/{id}/export/markdown", get(export_markdown))
        .route("/{id}/fork", post(fork_conversation))
}

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

async fn list_conversations(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let convos = state.sessions.list().await?;
    Ok(Json(json!({ "conversations": convos })))
}

async fn create_conversation(
    State(state): State<AppState>,
    Json(req): Json<CreateConversation>,
) -> AppResult<Json<Value>> {
    let convo = state.sessions.create(req).await?;
    Ok(Json(json!(convo)))
}

async fn get_conversation(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let convo = state.sessions.get(&id).await?;
    Ok(Json(json!(convo)))
}

async fn update_conversation(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<Value>,
) -> AppResult<Json<Value>> {
    let convo = state.sessions.update(&id, req).await?;
    Ok(Json(json!(convo)))
}

async fn delete_conversation(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    state.sessions.delete(&id).await?;
    Ok(Json(json!({ "deleted": true })))
}

async fn get_messages(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let messages = state.sessions.get_messages(&id).await?;
    Ok(Json(json!({ "messages": messages })))
}

async fn add_message(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<AddMessage>,
) -> AppResult<Json<Value>> {
    let msg = state.sessions.add_message(&id, req).await?;
    Ok(Json(json!(msg)))
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

async fn search_conversations(
    State(state): State<AppState>,
    Query(params): Query<SearchQuery>,
) -> AppResult<Json<Value>> {
    let results = state
        .db
        .search_conversations(&params.q)
        .await
        .map_err(AppError::Internal)?;
    Ok(Json(json!({ "conversations": results })))
}

async fn export_json(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    let convo_data = state.sessions.get(&id).await.map_err(AppError::Internal)?;
    Ok(Json(convo_data))
}

async fn export_markdown(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<String> {
    let convo_data = state.sessions.get(&id).await.map_err(AppError::Internal)?;

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

#[derive(Deserialize)]
pub struct ForkRequest {
    pub after_message_id: Option<String>,
}

async fn fork_conversation(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<ForkRequest>,
) -> AppResult<Json<Value>> {
    let forked = state
        .sessions
        .fork(&id, req.after_message_id.as_deref())
        .await
        .map_err(AppError::Internal)?;
    Ok(Json(json!(forked)))
}

async fn delete_message_handler(
    State(state): State<AppState>,
    Path((id, msg_id)): Path<(String, String)>,
) -> AppResult<Json<Value>> {
    state
        .sessions
        .delete_message(&id, &msg_id)
        .await
        .map_err(AppError::Internal)?;
    Ok(Json(json!({ "deleted": true })))
}

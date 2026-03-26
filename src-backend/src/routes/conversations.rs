use axum::{
    Router,
    extract::{State, Path},
    routing::get,
    Json,
};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::error::AppResult;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_conversations).post(create_conversation))
        .route("/{id}", get(get_conversation).put(update_conversation).delete(delete_conversation))
        .route("/{id}/messages", get(get_messages).post(add_message))
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

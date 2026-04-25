use axum::{
    Json, Router,
    extract::{Path, Query, State},
    routing::{delete, get, post},
};
use serde_json::Value;

pub use crate::app_core::conversations::{
    AddMessage, CreateConversation, ForkRequest, SearchQuery,
};

use crate::app_core::conversations;
use crate::error::AppResult;
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
        .route("/{id}/messages/{msg_id}", delete(delete_message_handler))
        .route("/{id}/export/json", get(export_json))
        .route("/{id}/export/markdown", get(export_markdown))
        .route("/{id}/fork", post(fork_conversation))
}

async fn list_conversations(State(state): State<AppState>) -> AppResult<Json<Value>> {
    Ok(Json(conversations::list_conversations(&state).await?))
}

async fn create_conversation(
    State(state): State<AppState>,
    Json(req): Json<CreateConversation>,
) -> AppResult<Json<Value>> {
    Ok(Json(conversations::create_conversation(&state, req).await?))
}

async fn get_conversation(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    Ok(Json(conversations::get_conversation(&state, &id).await?))
}

async fn update_conversation(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<Value>,
) -> AppResult<Json<Value>> {
    Ok(Json(
        conversations::update_conversation(&state, &id, req).await?,
    ))
}

async fn delete_conversation(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    Ok(Json(conversations::delete_conversation(&state, &id).await?))
}

async fn get_messages(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    Ok(Json(conversations::get_messages(&state, &id).await?))
}

async fn add_message(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<AddMessage>,
) -> AppResult<Json<Value>> {
    Ok(Json(conversations::add_message(&state, &id, req).await?))
}

async fn search_conversations(
    State(state): State<AppState>,
    Query(params): Query<SearchQuery>,
) -> AppResult<Json<Value>> {
    Ok(Json(
        conversations::search_conversations(&state, &params.q).await?,
    ))
}

async fn export_json(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    Ok(Json(conversations::export_json(&state, &id).await?))
}

async fn export_markdown(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<String> {
    conversations::export_markdown(&state, &id).await
}

async fn fork_conversation(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<ForkRequest>,
) -> AppResult<Json<Value>> {
    Ok(Json(
        conversations::fork_conversation(&state, &id, req).await?,
    ))
}

async fn delete_message_handler(
    State(state): State<AppState>,
    Path((id, msg_id)): Path<(String, String)>,
) -> AppResult<Json<Value>> {
    Ok(Json(
        conversations::delete_message(&state, &id, &msg_id).await?,
    ))
}

use std::sync::Arc;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::db::Database;
use crate::routes::conversations::{CreateConversation, AddMessage};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub model_id: Option<String>,
    pub preset_id: Option<String>,
    pub system_prompt: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub tokens_used: Option<u32>,
    pub generation_time_ms: Option<u64>,
    pub created_at: String,
}

pub struct SessionManager {
    db: Arc<Database>,
}

impl SessionManager {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    pub async fn list(&self) -> Result<Vec<Conversation>> {
        self.db.list_conversations().await
    }

    pub async fn create(&self, req: CreateConversation) -> Result<Conversation> {
        let convo = Conversation {
            id: uuid::Uuid::new_v4().to_string(),
            title: req.title.unwrap_or_else(|| "New Chat".to_string()),
            model_id: req.model_id,
            preset_id: req.preset_id,
            system_prompt: req.system_prompt,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
        self.db.insert_conversation(&convo).await?;
        Ok(convo)
    }

    pub async fn get(&self, id: &str) -> Result<Value> {
        let convo = self.db.get_conversation(id).await?;
        let messages = self.db.get_messages(id).await?;
        Ok(serde_json::json!({
            "conversation": convo,
            "messages": messages,
        }))
    }

    pub async fn get_messages(&self, conversation_id: &str) -> Result<Vec<Message>> {
        self.db.get_messages(conversation_id).await
    }

    pub async fn add_message(&self, conversation_id: &str, req: AddMessage) -> Result<Message> {
        let msg = Message {
            id: uuid::Uuid::new_v4().to_string(),
            conversation_id: conversation_id.to_string(),
            role: req.role,
            content: req.content,
            tokens_used: req.tokens_used,
            generation_time_ms: req.generation_time_ms,
            created_at: chrono::Utc::now().to_rfc3339(),
        };
        self.db.insert_message(&msg).await?;
        Ok(msg)
    }

    pub async fn update(&self, id: &str, updates: Value) -> Result<Conversation> {
        self.db.update_conversation(id, updates).await
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        self.db.delete_conversation(id).await
    }
}

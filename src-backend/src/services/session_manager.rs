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
    pub attachments: Vec<MessageAttachment>,
    pub tokens_used: Option<u32>,
    pub generation_time_ms: Option<u64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageAttachment {
    pub id: String,
    pub name: String,
    pub mime_type: String,
    pub size_bytes: u64,
    pub content: String,
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
        if let Some(model_id) = convo.model_id.as_deref() {
            self.db.touch_model_last_used(model_id).await?;
        }
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
            attachments: req.attachments.unwrap_or_default(),
            tokens_used: req.tokens_used,
            generation_time_ms: req.generation_time_ms,
            created_at: chrono::Utc::now().to_rfc3339(),
        };
        self.db.insert_message(&msg).await?;
        self.db.touch_model_last_used_for_conversation(conversation_id).await?;
        Ok(msg)
    }

    pub async fn update(&self, id: &str, updates: Value) -> Result<Conversation> {
        self.db.update_conversation(id, updates).await
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        self.db.delete_conversation(id).await
    }

    /// Fork a conversation — creates a copy with all messages up to (and including)
    /// the given message_id. If no message_id is provided, copies everything.
    pub async fn fork(&self, id: &str, after_message_id: Option<&str>) -> Result<Value> {
        let original = self.db.get_conversation(id).await?;
        let original_messages = self.db.get_messages(id).await?;

        let new_id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let forked = Conversation {
            id: new_id.clone(),
            title: format!("{} (fork)", original.title),
            model_id: original.model_id,
            preset_id: original.preset_id,
            system_prompt: original.system_prompt,
            created_at: now.clone(),
            updated_at: now.clone(),
        };
        self.db.insert_conversation(&forked).await?;

        // Copy messages up to the cutoff
        for msg in &original_messages {
            let new_msg = Message {
                id: uuid::Uuid::new_v4().to_string(),
                conversation_id: new_id.clone(),
                role: msg.role.clone(),
                content: msg.content.clone(),
                attachments: msg.attachments.clone(),
                tokens_used: msg.tokens_used,
                generation_time_ms: msg.generation_time_ms,
                created_at: msg.created_at.clone(),
            };
            self.db.insert_message(&new_msg).await?;

            if let Some(cutoff) = after_message_id {
                if msg.id == cutoff {
                    break;
                }
            }
        }

        Ok(serde_json::json!(forked))
    }
}

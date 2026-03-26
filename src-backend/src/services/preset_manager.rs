use std::sync::Arc;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::db::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preset {
    pub id: String,
    pub name: String,
    pub description: String,
    pub profile: String,
    pub parameters: Value,
    pub system_prompt: Option<String>,
    pub is_builtin: bool,
}

pub struct PresetManager {
    db: Arc<Database>,
}

impl PresetManager {
    pub async fn new(db: Arc<Database>) -> Result<Self> {
        let manager = Self { db };
        manager.seed_defaults().await?;
        Ok(manager)
    }

    async fn seed_defaults(&self) -> Result<()> {
        let defaults = vec![
            Preset {
                id: "preset-creative".to_string(),
                name: "Creative Writing".to_string(),
                description: "High creativity, varied responses".to_string(),
                profile: "normal".to_string(),
                parameters: serde_json::json!({
                    "temperature": 0.9,
                    "top_p": 0.95,
                    "top_k": 60,
                    "repeat_penalty": 1.1,
                }),
                system_prompt: Some("You are a creative writing assistant.".to_string()),
                is_builtin: true,
            },
            Preset {
                id: "preset-precise".to_string(),
                name: "Precise Q&A".to_string(),
                description: "Factual, focused responses".to_string(),
                profile: "normal".to_string(),
                parameters: serde_json::json!({
                    "temperature": 0.3,
                    "top_p": 0.9,
                    "top_k": 40,
                    "repeat_penalty": 1.0,
                }),
                system_prompt: Some("You are a helpful and precise assistant.".to_string()),
                is_builtin: true,
            },
            Preset {
                id: "preset-code".to_string(),
                name: "Code Assistant".to_string(),
                description: "Optimized for code generation".to_string(),
                profile: "normal".to_string(),
                parameters: serde_json::json!({
                    "temperature": 0.2,
                    "top_p": 0.85,
                    "top_k": 30,
                    "repeat_penalty": 1.0,
                }),
                system_prompt: Some("You are an expert programmer. Write clean, efficient code.".to_string()),
                is_builtin: true,
            },
            Preset {
                id: "preset-balanced".to_string(),
                name: "Balanced".to_string(),
                description: "Good all-around settings".to_string(),
                profile: "normal".to_string(),
                parameters: serde_json::json!({
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "top_k": 40,
                    "repeat_penalty": 1.05,
                }),
                system_prompt: None,
                is_builtin: true,
            },
        ];

        for preset in defaults {
            self.db.upsert_preset(&preset).await?;
        }

        Ok(())
    }

    pub async fn list(&self) -> Result<Vec<Preset>> {
        self.db.list_presets().await
    }

    pub async fn create(&self, req: Value) -> Result<Preset> {
        let mut preset: Preset = serde_json::from_value(req)?;
        preset.id = uuid::Uuid::new_v4().to_string();
        preset.is_builtin = false;
        self.db.upsert_preset(&preset).await?;
        Ok(preset)
    }

    pub async fn get(&self, id: &str) -> Result<Preset> {
        self.db.get_preset(id).await
    }

    pub async fn update(&self, id: &str, req: Value) -> Result<Preset> {
        self.db.update_preset(id, req).await
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        self.db.delete_preset(id).await
    }
}

use anyhow::Result;
use rusqlite::Connection;
use serde_json::Value;
use std::sync::Mutex;

use crate::services::model_registry::Model;
use crate::services::session_manager::{Conversation, Message};
use crate::services::preset_manager::Preset;

/// Current schema version for migration tracking.
const SCHEMA_VERSION: u32 = 1;

/// SQLite database wrapper with synchronous rusqlite behind a Mutex.
/// All public methods are async for compatibility with Axum handlers.
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub async fn new() -> Result<Self> {
        let db_path = dirs::data_local_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("ai-studio")
            .join("ai-studio.db");

        // Ensure directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        let db = Self { conn: Mutex::new(conn) };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // Bootstrap the schema_version table
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);"
        )?;

        let current: u32 = conn
            .query_row("SELECT COALESCE(MAX(version), 0) FROM schema_version", [], |r| r.get(0))
            .unwrap_or(0);

        if current < 1 {
            conn.execute_batch(
                "
                CREATE TABLE IF NOT EXISTS models (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    path TEXT NOT NULL UNIQUE,
                    size_bytes INTEGER NOT NULL,
                    quantization TEXT,
                    architecture TEXT,
                    parameters TEXT,
                    context_length INTEGER,
                    added_at TEXT NOT NULL,
                    last_used TEXT
                );

                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    model_id TEXT,
                    preset_id TEXT,
                    system_prompt TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tokens_used INTEGER,
                    generation_time_ms INTEGER,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS presets (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    profile TEXT NOT NULL DEFAULT 'normal',
                    parameters TEXT NOT NULL DEFAULT '{}',
                    system_prompt TEXT,
                    is_builtin INTEGER NOT NULL DEFAULT 0
                );

                CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
                CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);

                INSERT INTO schema_version (version) VALUES (1);
                "
            )?;
            tracing::info!("Database migrated to schema version 1");
        }

        tracing::info!(version = SCHEMA_VERSION, "Database schema is up to date");
        Ok(())
    }

    // === Config ===

    pub async fn get_config(&self) -> Result<Value> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT key, value FROM config")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut map = serde_json::Map::new();
        for row in rows {
            let (key, value) = row?;
            if let Ok(v) = serde_json::from_str::<Value>(&value) {
                map.insert(key, v);
            } else {
                map.insert(key, Value::String(value));
            }
        }
        Ok(Value::Object(map))
    }

    pub async fn set_config(&self, config: &Value) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        if let Some(obj) = config.as_object() {
            for (key, value) in obj {
                conn.execute(
                    "INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)",
                    rusqlite::params![key, value.to_string()],
                )?;
            }
        }
        Ok(())
    }

    // === Models ===

    pub async fn list_models(&self) -> Result<Vec<Model>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM models ORDER BY name")?;
        let models = stmt.query_map([], |row| {
            Ok(Model {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                size_bytes: row.get(3)?,
                quantization: row.get(4)?,
                architecture: row.get(5)?,
                parameters: row.get(6)?,
                context_length: row.get(7)?,
                added_at: row.get(8)?,
                last_used: row.get(9)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        Ok(models)
    }

    pub async fn upsert_model(&self, model: &Model) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO models (id, name, path, size_bytes, quantization, architecture, parameters, context_length, added_at, last_used)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                model.id, model.name, model.path, model.size_bytes,
                model.quantization, model.architecture, model.parameters,
                model.context_length, model.added_at, model.last_used
            ],
        )?;
        Ok(())
    }

    pub async fn get_model(&self, id: &str) -> Result<Model> {
        let conn = self.conn.lock().unwrap();
        let model = conn.query_row(
            "SELECT * FROM models WHERE id = ?1",
            [id],
            |row| {
                Ok(Model {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    path: row.get(2)?,
                    size_bytes: row.get(3)?,
                    quantization: row.get(4)?,
                    architecture: row.get(5)?,
                    parameters: row.get(6)?,
                    context_length: row.get(7)?,
                    added_at: row.get(8)?,
                    last_used: row.get(9)?,
                })
            },
        )?;
        Ok(model)
    }

    pub async fn delete_model(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM models WHERE id = ?1", [id])?;
        Ok(())
    }

    pub async fn model_exists_by_path(&self, path: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let count: u32 = conn.query_row(
            "SELECT COUNT(*) FROM models WHERE path = ?1",
            [path],
            |r| r.get(0),
        )?;
        Ok(count > 0)
    }

    // === Conversations ===

    pub async fn list_conversations(&self) -> Result<Vec<Conversation>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, title, model_id, preset_id, system_prompt, created_at, updated_at FROM conversations ORDER BY updated_at DESC")?;
        let convos = stmt.query_map([], |row| {
            Ok(Conversation {
                id: row.get(0)?,
                title: row.get(1)?,
                model_id: row.get(2)?,
                preset_id: row.get(3)?,
                system_prompt: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        Ok(convos)
    }

    pub async fn insert_conversation(&self, convo: &Conversation) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO conversations (id, title, model_id, preset_id, system_prompt, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![convo.id, convo.title, convo.model_id, convo.preset_id, convo.system_prompt, convo.created_at, convo.updated_at],
        )?;
        Ok(())
    }

    pub async fn get_conversation(&self, id: &str) -> Result<Conversation> {
        let conn = self.conn.lock().unwrap();
        let convo = conn.query_row(
            "SELECT id, title, model_id, preset_id, system_prompt, created_at, updated_at FROM conversations WHERE id = ?1",
            [id],
            |row| {
                Ok(Conversation {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    model_id: row.get(2)?,
                    preset_id: row.get(3)?,
                    system_prompt: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            },
        )?;
        Ok(convo)
    }

    pub async fn update_conversation(&self, id: &str, updates: Value) -> Result<Conversation> {
        {
            let conn = self.conn.lock().unwrap();
            if let Some(obj) = updates.as_object() {
                if let Some(title) = obj.get("title").and_then(|v| v.as_str()) {
                    conn.execute(
                        "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
                        rusqlite::params![title, chrono::Utc::now().to_rfc3339(), id],
                    )?;
                }
                if let Some(system_prompt) = obj.get("system_prompt").and_then(|v| v.as_str()) {
                    conn.execute(
                        "UPDATE conversations SET system_prompt = ?1, updated_at = ?2 WHERE id = ?3",
                        rusqlite::params![system_prompt, chrono::Utc::now().to_rfc3339(), id],
                    )?;
                }
            }
        }
        self.get_conversation(id).await
    }

    pub async fn delete_conversation(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM messages WHERE conversation_id = ?1", [id])?;
        conn.execute("DELETE FROM conversations WHERE id = ?1", [id])?;
        Ok(())
    }

    pub async fn get_messages(&self, conversation_id: &str) -> Result<Vec<Message>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, conversation_id, role, content, tokens_used, generation_time_ms, created_at FROM messages WHERE conversation_id = ?1 ORDER BY created_at"
        )?;
        let messages = stmt.query_map([conversation_id], |row| {
            Ok(Message {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                tokens_used: row.get(4)?,
                generation_time_ms: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        Ok(messages)
    }

    pub async fn insert_message(&self, msg: &Message) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, tokens_used, generation_time_ms, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                msg.id, msg.conversation_id, msg.role, msg.content,
                msg.tokens_used, msg.generation_time_ms, msg.created_at
            ],
        )?;
        // Touch the conversation's updated_at timestamp
        conn.execute(
            "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
            rusqlite::params![msg.created_at, msg.conversation_id],
        )?;
        Ok(())
    }

    // === Presets ===

    pub async fn list_presets(&self) -> Result<Vec<Preset>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, description, profile, parameters, system_prompt, is_builtin FROM presets ORDER BY is_builtin DESC, name")?;
        let presets = stmt.query_map([], |row| {
            let params_str: String = row.get(4)?;
            let parameters = serde_json::from_str(&params_str).unwrap_or(Value::Object(Default::default()));
            Ok(Preset {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                profile: row.get(3)?,
                parameters,
                system_prompt: row.get(5)?,
                is_builtin: row.get::<_, i32>(6)? != 0,
            })
        })?.filter_map(|r| r.ok()).collect();
        Ok(presets)
    }

    pub async fn upsert_preset(&self, preset: &Preset) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO presets (id, name, description, profile, parameters, system_prompt, is_builtin) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                preset.id, preset.name, preset.description, preset.profile,
                preset.parameters.to_string(), preset.system_prompt,
                preset.is_builtin as i32
            ],
        )?;
        Ok(())
    }

    pub async fn get_preset(&self, id: &str) -> Result<Preset> {
        let conn = self.conn.lock().unwrap();
        let preset = conn.query_row(
            "SELECT id, name, description, profile, parameters, system_prompt, is_builtin FROM presets WHERE id = ?1",
            [id],
            |row| {
                let params_str: String = row.get(4)?;
                let parameters = serde_json::from_str(&params_str).unwrap_or(Value::Object(Default::default()));
                Ok(Preset {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    profile: row.get(3)?,
                    parameters,
                    system_prompt: row.get(5)?,
                    is_builtin: row.get::<_, i32>(6)? != 0,
                })
            },
        )?;
        Ok(preset)
    }

    pub async fn update_preset(&self, id: &str, updates: Value) -> Result<Preset> {
        {
            let conn = self.conn.lock().unwrap();
            if let Some(obj) = updates.as_object() {
                if let Some(name) = obj.get("name").and_then(|v| v.as_str()) {
                    conn.execute("UPDATE presets SET name = ?1 WHERE id = ?2 AND is_builtin = 0", rusqlite::params![name, id])?;
                }
                if let Some(desc) = obj.get("description").and_then(|v| v.as_str()) {
                    conn.execute("UPDATE presets SET description = ?1 WHERE id = ?2 AND is_builtin = 0", rusqlite::params![desc, id])?;
                }
                if let Some(params) = obj.get("parameters") {
                    conn.execute("UPDATE presets SET parameters = ?1 WHERE id = ?2 AND is_builtin = 0", rusqlite::params![params.to_string(), id])?;
                }
                if let Some(sp) = obj.get("system_prompt").and_then(|v| v.as_str()) {
                    conn.execute("UPDATE presets SET system_prompt = ?1 WHERE id = ?2 AND is_builtin = 0", rusqlite::params![sp, id])?;
                }
            }
        }
        self.get_preset(id).await
    }

    pub async fn delete_preset(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM presets WHERE id = ?1 AND is_builtin = 0", [id])?;
        Ok(())
    }
}

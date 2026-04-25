use anyhow::Result;
use rusqlite::Connection;
use serde_json::Value;
use std::path::Path;
use std::sync::Mutex;

use crate::services::model_registry::{Model, ModelAnalytics, ModelConversationSummary};
use crate::services::preset_manager::Preset;
use crate::services::session_manager::{Conversation, Message, MessageAttachment};

/// Current schema version for migration tracking.
const SCHEMA_VERSION: u32 = 3;

fn estimate_tokens_from_content(content: &str) -> u64 {
    ((content.chars().count() as f64) / 4.0).ceil() as u64
}

/// SQLite database wrapper with synchronous rusqlite behind a Mutex.
/// All public methods are async for compatibility with Axum handlers.
pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub async fn new() -> Result<Self> {
        let data_root = dirs::data_local_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
        let db_path = data_root.join("llamastudio").join("llamastudio.db");
        let legacy_db_path = data_root.join("ai-studio").join("ai-studio.db");

        if !db_path.exists() && legacy_db_path.exists() {
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(&legacy_db_path, &db_path)?;
        }

        // Ensure directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        Self::open_connection(Connection::open(&db_path)?)
    }

    pub async fn new_in_memory() -> Result<Self> {
        Self::open_connection(Connection::open_in_memory()?)
    }

    pub async fn open_at<P: AsRef<Path>>(db_path: P) -> Result<Self> {
        let db_path = db_path.as_ref();
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        Self::open_connection(Connection::open(db_path)?)
    }

    fn open_connection(conn: Connection) -> Result<Self> {
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn table_has_column(conn: &Connection, table: &str, column: &str) -> Result<bool> {
        let pragma = format!("PRAGMA table_info({table})");
        let mut stmt = conn.prepare(&pragma)?;
        let columns = stmt.query_map([], |row| row.get::<_, String>(1))?;

        for existing_column in columns {
            if existing_column? == column {
                return Ok(true);
            }
        }

        Ok(false)
    }

    fn run_migrations(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        // Bootstrap the schema_version table
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);",
        )?;

        let mut current: u32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_version",
                [],
                |r| r.get(0),
            )
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
                    attachments_json TEXT NOT NULL DEFAULT '[]',
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

                DELETE FROM schema_version;
                INSERT INTO schema_version (version) VALUES (2);
                "
            )?;
            current = 2;
            tracing::info!("Database migrated to schema version 2");
        }

        if current < 2 {
            if !Self::table_has_column(&conn, "messages", "attachments_json")? {
                conn.execute_batch(
                    "ALTER TABLE messages ADD COLUMN attachments_json TEXT NOT NULL DEFAULT '[]';",
                )?;
            }

            conn.execute("DELETE FROM schema_version", [])?;
            conn.execute("INSERT INTO schema_version (version) VALUES (?1)", [2])?;
            tracing::info!("Database migrated to schema version 2");
            current = 2;
        }

        if current < 3 {
            conn.execute_batch(
                "
                CREATE TABLE IF NOT EXISTS desktop_ui_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    app_prefs_json TEXT NOT NULL DEFAULT '{}',
                    custom_templates_json TEXT NOT NULL DEFAULT '[]'
                );
                INSERT OR IGNORE INTO desktop_ui_state (id, app_prefs_json, custom_templates_json)
                    VALUES (1, '{}', '[]');
                ",
            )?;
            conn.execute("DELETE FROM schema_version", [])?;
            conn.execute(
                "INSERT INTO schema_version (version) VALUES (?1)",
                [SCHEMA_VERSION],
            )?;
            tracing::info!("Database migrated to schema version 3 (desktop UI state)");
        }

        tracing::info!(version = SCHEMA_VERSION, "Database schema is up to date");
        Ok(())
    }

    /// Durable UI preferences for the native desktop shell (not browser localStorage).
    pub async fn get_desktop_ui_state(&self) -> Result<(Value, Value)> {
        let conn = self.conn.lock().unwrap();
        let (app, templates): (String, String) = conn.query_row(
            "SELECT app_prefs_json, custom_templates_json FROM desktop_ui_state WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        let app_v =
            serde_json::from_str(&app).unwrap_or_else(|_| Value::Object(Default::default()));
        let templates_v =
            serde_json::from_str(&templates).unwrap_or_else(|_| Value::Array(Default::default()));
        Ok((app_v, templates_v))
    }

    pub async fn set_desktop_ui_app_prefs(&self, prefs: &Value) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE desktop_ui_state SET app_prefs_json = ?1 WHERE id = 1",
            [prefs.to_string()],
        )?;
        Ok(())
    }

    pub async fn set_desktop_ui_custom_templates(&self, templates: &Value) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE desktop_ui_state SET custom_templates_json = ?1 WHERE id = 1",
            [templates.to_string()],
        )?;
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
        let models = stmt
            .query_map([], |row| {
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
            })?
            .filter_map(|r| r.ok())
            .collect();
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
        let model = conn.query_row("SELECT * FROM models WHERE id = ?1", [id], |row| {
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
        })?;
        Ok(model)
    }

    pub async fn delete_model(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM models WHERE id = ?1", [id])?;
        Ok(())
    }

    pub async fn model_exists_by_path(&self, path: &str) -> Result<bool> {
        let conn = self.conn.lock().unwrap();
        let count: u32 =
            conn.query_row("SELECT COUNT(*) FROM models WHERE path = ?1", [path], |r| {
                r.get(0)
            })?;
        Ok(count > 0)
    }

    // === Conversations ===

    pub async fn list_conversations(&self) -> Result<Vec<Conversation>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, title, model_id, preset_id, system_prompt, created_at, updated_at FROM conversations ORDER BY updated_at DESC")?;
        let convos = stmt
            .query_map([], |row| {
                Ok(Conversation {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    model_id: row.get(2)?,
                    preset_id: row.get(3)?,
                    system_prompt: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
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
            "SELECT id, conversation_id, role, content, attachments_json, tokens_used, generation_time_ms, created_at FROM messages WHERE conversation_id = ?1 ORDER BY created_at"
        )?;
        let messages = stmt
            .query_map([conversation_id], |row| {
                let attachments_json: String = row.get(4)?;
                Ok(Message {
                    id: row.get(0)?,
                    conversation_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    attachments: serde_json::from_str::<Vec<MessageAttachment>>(&attachments_json)
                        .unwrap_or_default(),
                    tokens_used: row.get(5)?,
                    generation_time_ms: row.get(6)?,
                    created_at: row.get(7)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(messages)
    }

    pub async fn insert_message(&self, msg: &Message) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, attachments_json, tokens_used, generation_time_ms, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                msg.id, msg.conversation_id, msg.role, msg.content,
                serde_json::to_string(&msg.attachments)?,
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

    pub async fn touch_model_last_used(&self, model_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE models SET last_used = ?1 WHERE id = ?2",
            rusqlite::params![chrono::Utc::now().to_rfc3339(), model_id],
        )?;
        Ok(())
    }

    pub async fn touch_model_last_used_for_conversation(
        &self,
        conversation_id: &str,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE models
             SET last_used = ?1
             WHERE id = (SELECT model_id FROM conversations WHERE id = ?2)",
            rusqlite::params![chrono::Utc::now().to_rfc3339(), conversation_id],
        )?;
        Ok(())
    }

    pub async fn get_model_analytics(&self, model_id: &str) -> Result<ModelAnalytics> {
        let model = self.get_model(model_id).await?;
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT c.id, c.title, c.updated_at, m.role, m.tokens_used, m.generation_time_ms, m.attachments_json, m.content
             FROM conversations c
             LEFT JOIN messages m ON m.conversation_id = c.id
             WHERE c.model_id = ?1
             ORDER BY c.updated_at DESC, m.created_at ASC"
        )?;

        let mut rows = stmt.query([model_id])?;
        let mut recent_conversations: Vec<ModelConversationSummary> = Vec::new();
        let mut current_conversation_id: Option<String> = None;
        let mut current_conversation: Option<ModelConversationSummary> = None;
        let mut conversation_count: u32 = 0;
        let mut message_count: u32 = 0;
        let mut assistant_message_count: u32 = 0;
        let mut attachment_count: u32 = 0;
        let mut total_tokens: u64 = 0;
        let mut total_generation_time_ms: u64 = 0;

        while let Some(row) = rows.next()? {
            let conversation_id: String = row.get(0)?;
            let title: String = row.get(1)?;
            let updated_at: String = row.get(2)?;
            let role: Option<String> = row.get(3)?;
            let tokens_used: Option<u32> = row.get(4)?;
            let generation_time_ms: Option<u64> = row.get(5)?;
            let attachments_json: Option<String> = row.get(6)?;
            let content: Option<String> = row.get(7)?;

            if current_conversation_id.as_deref() != Some(conversation_id.as_str()) {
                if let Some(summary) = current_conversation.take() {
                    recent_conversations.push(summary);
                }

                current_conversation_id = Some(conversation_id.clone());
                current_conversation = Some(ModelConversationSummary {
                    id: conversation_id.clone(),
                    title,
                    updated_at,
                    message_count: 0,
                    assistant_messages: 0,
                    attachment_count: 0,
                    total_tokens: 0,
                    total_generation_time_ms: 0,
                });
                conversation_count += 1;
            }

            if let Some(role) = role {
                let attachments_len = attachments_json
                    .as_deref()
                    .and_then(|json| serde_json::from_str::<Vec<MessageAttachment>>(json).ok())
                    .map(|attachments| attachments.len() as u32)
                    .unwrap_or(0);

                message_count += 1;
                attachment_count += attachments_len;

                if let Some(summary) = current_conversation.as_mut() {
                    summary.message_count += 1;
                    summary.attachment_count += attachments_len;
                }

                if role == "assistant" {
                    assistant_message_count += 1;
                    let token_count = tokens_used.map(u64::from).unwrap_or_else(|| {
                        content
                            .as_deref()
                            .map(estimate_tokens_from_content)
                            .unwrap_or(0)
                    });
                    let generation_ms = generation_time_ms.unwrap_or(0);
                    total_tokens += token_count;
                    total_generation_time_ms += generation_ms;

                    if let Some(summary) = current_conversation.as_mut() {
                        summary.assistant_messages += 1;
                        summary.total_tokens += token_count;
                        summary.total_generation_time_ms += generation_ms;
                    }
                }
            }
        }

        if let Some(summary) = current_conversation {
            recent_conversations.push(summary);
        }

        let avg_tokens_per_response = if assistant_message_count > 0 {
            Some(total_tokens as f64 / f64::from(assistant_message_count))
        } else {
            None
        };

        let avg_generation_time_ms = if assistant_message_count > 0 {
            Some(total_generation_time_ms as f64 / f64::from(assistant_message_count))
        } else {
            None
        };

        let tokens_per_second = if total_generation_time_ms > 0 {
            Some(total_tokens as f64 / (total_generation_time_ms as f64 / 1000.0))
        } else {
            None
        };

        Ok(ModelAnalytics {
            model_id: model.id,
            conversation_count,
            message_count,
            assistant_message_count,
            attachment_count,
            total_tokens,
            avg_tokens_per_response,
            total_generation_time_ms,
            avg_generation_time_ms,
            tokens_per_second,
            last_used: model.last_used,
            context_length: model.context_length,
            recent_conversations,
        })
    }

    // === Presets ===

    pub async fn list_presets(&self) -> Result<Vec<Preset>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, description, profile, parameters, system_prompt, is_builtin FROM presets ORDER BY is_builtin DESC, name")?;
        let presets = stmt
            .query_map([], |row| {
                let params_str: String = row.get(4)?;
                let parameters =
                    serde_json::from_str(&params_str).unwrap_or(Value::Object(Default::default()));
                Ok(Preset {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    profile: row.get(3)?,
                    parameters,
                    system_prompt: row.get(5)?,
                    is_builtin: row.get::<_, i32>(6)? != 0,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
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
                    conn.execute(
                        "UPDATE presets SET name = ?1 WHERE id = ?2 AND is_builtin = 0",
                        rusqlite::params![name, id],
                    )?;
                }
                if let Some(desc) = obj.get("description").and_then(|v| v.as_str()) {
                    conn.execute(
                        "UPDATE presets SET description = ?1 WHERE id = ?2 AND is_builtin = 0",
                        rusqlite::params![desc, id],
                    )?;
                }
                if let Some(params) = obj.get("parameters") {
                    conn.execute(
                        "UPDATE presets SET parameters = ?1 WHERE id = ?2 AND is_builtin = 0",
                        rusqlite::params![params.to_string(), id],
                    )?;
                }
                if let Some(sp) = obj.get("system_prompt").and_then(|v| v.as_str()) {
                    conn.execute(
                        "UPDATE presets SET system_prompt = ?1 WHERE id = ?2 AND is_builtin = 0",
                        rusqlite::params![sp, id],
                    )?;
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

    // === Search ===

    /// Full-text search across conversations and messages.
    pub async fn search_conversations(&self, query: &str) -> Result<Vec<Conversation>> {
        let conn = self.conn.lock().unwrap();
        let pattern = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT DISTINCT c.id, c.title, c.model_id, c.preset_id, c.system_prompt, c.created_at, c.updated_at
             FROM conversations c
             LEFT JOIN messages m ON m.conversation_id = c.id
             WHERE c.title LIKE ?1 OR m.content LIKE ?1
             ORDER BY c.updated_at DESC
             LIMIT 50"
        )?;
        let convos = stmt
            .query_map([&pattern], |row| {
                Ok(Conversation {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    model_id: row.get(2)?,
                    preset_id: row.get(3)?,
                    system_prompt: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(convos)
    }

    /// Delete a single message by ID.
    pub async fn delete_message(&self, msg_id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM messages WHERE id = ?1", [msg_id])?;
        Ok(())
    }
}

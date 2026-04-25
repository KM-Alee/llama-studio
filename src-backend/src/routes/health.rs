use axum::Json;
use serde_json::Value;

use crate::app_core::health;

pub async fn health_check() -> Json<Value> {
    Json(health::health_json())
}

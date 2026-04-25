use serde_json::Value;

use crate::error::AppResult;
use crate::state::AppState;

pub async fn get_ui_preferences(state: &AppState) -> AppResult<Value> {
    let (app_prefs, templates) = state.db.get_desktop_ui_state().await?;
    Ok(serde_json::json!({
        "app_prefs": app_prefs,
        "custom_templates": templates,
    }))
}

pub async fn set_ui_preferences(
    state: &AppState,
    app_prefs: Option<Value>,
    custom_templates: Option<Value>,
) -> AppResult<Value> {
    if let Some(p) = app_prefs {
        state.db.set_desktop_ui_app_prefs(&p).await?;
    }
    if let Some(t) = custom_templates {
        state.db.set_desktop_ui_custom_templates(&t).await?;
    }
    get_ui_preferences(state).await
}

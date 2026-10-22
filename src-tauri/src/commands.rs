use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::entry;
use crate::store::Store;

pub struct AppState {
    pub store: Mutex<Store>,
}

#[derive(Debug, Clone, Serialize)]
pub struct EntryPayload {
    pub date: String,
    pub content: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct EntryMeta {
    pub date: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct MediaPayload {
    pub markdown: String,
    pub filename: String,
}

fn default_data_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

pub fn init_state(app: &AppHandle) -> AppState {
    let root = default_data_dir(app);
    AppState {
        store: Mutex::new(Store::new(root)),
    }
}

#[tauri::command]
pub fn today_date() -> String {
    entry::today_local()
        .format(entry::DATE_FORMAT)
        .to_string()
}

#[tauri::command]
pub fn data_dir(app: AppHandle) -> String {
    default_data_dir(&app).to_string_lossy().into_owned()
}

#[tauri::command]
pub fn get_entry(state: State<'_, AppState>, date: String) -> Result<EntryPayload, String> {
    let date = entry::parse_date(&date).map_err(|e| e.to_string())?;
    let store = state.store.lock().map_err(|e| e.to_string())?;
    let existing = store.read_entry(&date).map_err(|e| e.to_string())?;
    let (content, exists) = match existing {
        Some(c) => (c, true),
        None => (String::new(), false),
    };
    Ok(EntryPayload {
        date: date.format(entry::DATE_FORMAT).to_string(),
        exists,
        content,
    })
}

#[tauri::command]
pub fn save_entry(
    state: State<'_, AppState>,
    date: String,
    content: String,
) -> Result<EntryPayload, String> {
    let date = entry::parse_date(&date).map_err(|e| e.to_string())?;
    let store = state.store.lock().map_err(|e| e.to_string())?;
    store.save_entry(&date, &content).map_err(|e| e.to_string())?;
    Ok(EntryPayload {
        date: date.format(entry::DATE_FORMAT).to_string(),
        exists: true,
        content,
    })
}

#[tauri::command]
pub fn list_entries(state: State<'_, AppState>) -> Result<Vec<EntryMeta>, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    let dates = store.list_dates().map_err(|e| e.to_string())?;
    Ok(dates
        .into_iter()
        .map(|d| EntryMeta {
            date: d.format(entry::DATE_FORMAT).to_string(),
        })
        .collect())
}

#[tauri::command]
pub fn save_media(
    state: State<'_, AppState>,
    bytes: Vec<u8>,
    ext: Option<String>,
) -> Result<MediaPayload, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    let markdown = store
        .store_media(&bytes, ext.as_deref())
        .map_err(|e| e.to_string())?;
    let filename = markdown
        .trim_start_matches("![pasted image](")
        .trim_end_matches(')')
        .trim_start_matches("../media/")
        .to_string();
    Ok(MediaPayload { markdown, filename })
}

#[tauri::command]
pub fn media_path(state: State<'_, AppState>, reference: String) -> Result<String, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    store
        .resolve_media(&reference)
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| "media not found".to_string())
}

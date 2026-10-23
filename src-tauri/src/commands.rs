use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::entry;
use crate::store::{NotebookMeta, Store};

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

pub fn init_state(app: &AppHandle) -> std::io::Result<AppState> {
    let root = default_data_dir(app);
    let store = Store::new(root);
    store.init()?;
    Ok(AppState {
        store: Mutex::new(store),
    })
}

fn with_store<T>(
    state: &State<'_, AppState>,
    f: impl FnOnce(&Store) -> Result<T, String>,
) -> Result<T, String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    f(&store)
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
pub fn list_notebooks(state: State<'_, AppState>) -> Result<Vec<NotebookMeta>, String> {
    with_store(&state, |s| s.list_notebooks().map_err(|e| e.to_string()))
}

#[tauri::command]
pub fn create_notebook(
    state: State<'_, AppState>,
    name: String,
    cover: String,
    emoji: Option<String>,
) -> Result<NotebookMeta, String> {
    with_store(&state, |s| {
        s.create_notebook(&name, &cover, emoji.as_deref())
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn set_notebook_emoji(
    state: State<'_, AppState>,
    id: String,
    emoji: Option<String>,
) -> Result<NotebookMeta, String> {
    with_store(&state, |s| {
        s.set_notebook_emoji(&id, emoji.as_deref())
            .map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn rename_notebook(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> Result<NotebookMeta, String> {
    with_store(&state, |s| {
        s.rename_notebook(&id, &name).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn set_notebook_cover(
    state: State<'_, AppState>,
    id: String,
    cover: String,
) -> Result<NotebookMeta, String> {
    with_store(&state, |s| {
        s.set_notebook_cover(&id, &cover).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn get_entry(
    state: State<'_, AppState>,
    notebook: String,
    date: String,
) -> Result<EntryPayload, String> {
    let date = entry::parse_date(&date).map_err(|e| e.to_string())?;
    with_store(&state, |s| {
        let existing = s.read_entry(&notebook, &date).map_err(|e| e.to_string())?;
        let (content, exists) = match existing {
            Some(c) => (c, true),
            None => (String::new(), false),
        };
        Ok(EntryPayload {
            date: date.format(entry::DATE_FORMAT).to_string(),
            exists,
            content,
        })
    })
}

#[tauri::command]
pub fn save_entry(
    state: State<'_, AppState>,
    notebook: String,
    date: String,
    content: String,
) -> Result<EntryPayload, String> {
    let date = entry::parse_date(&date).map_err(|e| e.to_string())?;
    with_store(&state, |s| {
        s.save_entry(&notebook, &date, &content)
            .map_err(|e| e.to_string())?;
        Ok(EntryPayload {
            date: date.format(entry::DATE_FORMAT).to_string(),
            exists: true,
            content,
        })
    })
}

#[tauri::command]
pub fn delete_entry(
    state: State<'_, AppState>,
    notebook: String,
    date: String,
) -> Result<bool, String> {
    let date = entry::parse_date(&date).map_err(|e| e.to_string())?;
    with_store(&state, |s| {
        s.delete_entry(&notebook, &date).map_err(|e| e.to_string())
    })
}

#[tauri::command]
pub fn list_entries(
    state: State<'_, AppState>,
    notebook: String,
) -> Result<Vec<EntryMeta>, String> {
    with_store(&state, |s| {
        let dates = s.list_dates(&notebook).map_err(|e| e.to_string())?;
        Ok(dates
            .into_iter()
            .map(|d| EntryMeta {
                date: d.format(entry::DATE_FORMAT).to_string(),
            })
            .collect())
    })
}

#[tauri::command]
pub fn save_media(
    state: State<'_, AppState>,
    notebook: String,
    bytes: Vec<u8>,
    ext: Option<String>,
) -> Result<MediaPayload, String> {
    with_store(&state, |s| {
        let markdown = s
            .store_media(&notebook, &bytes, ext.as_deref())
            .map_err(|e| e.to_string())?;
        let filename = markdown
            .trim_start_matches("![pasted image](")
            .trim_end_matches(')')
            .trim_start_matches("../media/")
            .to_string();
        Ok(MediaPayload { markdown, filename })
    })
}

#[derive(Debug, Clone, Serialize)]
pub struct MediaData {
    pub data: Vec<u8>,
    pub mime: String,
}

#[tauri::command]
pub fn read_media(
    state: State<'_, AppState>,
    notebook: String,
    reference: String,
) -> Result<MediaData, String> {
    with_store(&state, |s| {
        s.read_media(&notebook, &reference)
            .map(|(data, mime)| MediaData {
                data,
                mime: mime.to_string(),
            })
            .ok_or_else(|| "media not found".to_string())
    })
}

#[tauri::command]
pub fn media_path(
    state: State<'_, AppState>,
    notebook: String,
    reference: String,
) -> Result<String, String> {
    with_store(&state, |s| {
        s.resolve_media(&notebook, &reference)
            .map(|p| p.to_string_lossy().into_owned())
            .ok_or_else(|| "media not found".to_string())
    })
}

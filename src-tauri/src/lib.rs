mod commands;
mod entry;
mod media;
mod store;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = commands::init_state(app.handle()).map_err(std::io::Error::other)?;
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::today_date,
            commands::data_dir,
            commands::list_notebooks,
            commands::create_notebook,
            commands::rename_notebook,
            commands::set_notebook_cover,
            commands::get_entry,
            commands::save_entry,
            commands::delete_entry,
            commands::list_entries,
            commands::save_media,
            commands::media_path,
            commands::read_media,
        ])
        .run(tauri::generate_context!())
        .expect("error while running VeldNotes");
}

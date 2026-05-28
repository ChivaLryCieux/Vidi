mod commands;
mod data;
mod metrics;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_sessions,
            commands::add_manual_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vidi");
}

mod badge;
mod commands;
mod data;
mod metrics;

use tauri::{Manager, utils::config::Color};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let paper = Color(244, 249, 237, 255);
                window.set_background_color(Some(paper))?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_sessions,
            commands::add_manual_session,
            commands::gen_badge,
            commands::gen_hidden_badge,
            commands::gen_hidden_black_badge
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vidi");
}

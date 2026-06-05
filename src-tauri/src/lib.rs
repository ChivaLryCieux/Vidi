mod badge;
mod commands;
mod data;
mod metrics;
mod storage;
mod summary;

use tauri::{Manager, utils::config::Color, webview::PageLoadEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .on_page_load(|webview, payload| {
            if matches!(payload.event(), PageLoadEvent::Finished) {
                // Workaround: force WebKitGTK to trigger initial paint
                let _ = webview.eval("void document.body.offsetHeight");
            }
        })
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
            commands::gen_hidden_black_badge,
            commands::get_badges,
            commands::save_badge,
            commands::delete_badge,
            commands::get_summary
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vidi");
}

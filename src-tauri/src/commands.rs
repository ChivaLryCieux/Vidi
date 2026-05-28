use crate::data::load_all_sessions;
use crate::metrics::{build_manual_session, build_metric, SessionMetric};

#[tauri::command]
pub fn get_sessions() -> Vec<SessionMetric> {
    let raws = load_all_sessions();
    raws.iter().map(build_metric).collect()
}

#[tauri::command]
pub fn add_manual_session(
    theme: String,
    mistake_rate: f64,
    deep_rate: f64,
    avg_speed: f64,
    max_hr: f64,
) -> SessionMetric {
    let raws = load_all_sessions();
    let metrics: Vec<SessionMetric> = raws.iter().map(build_metric).collect();
    let latest = metrics.last().expect("no sessions available");
    let next_index = metrics.len() as i64 + 1;
    build_manual_session(&theme, mistake_rate, deep_rate, avg_speed, max_hr, next_index, latest)
}

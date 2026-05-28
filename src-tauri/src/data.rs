use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize, Clone)]
pub struct CurvePoint {
    pub x: f64,
    pub y: f64,
    pub height_m: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Trajectory {
    pub apex_height_m: f64,
    pub curve_points: Vec<CurvePoint>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct IncomingBall {
    pub from_position_x: f64,
    pub from_position_y: f64,
    pub speed_kmh: f64,
    pub spin_type: String,
    pub spin_rpm: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct OutgoingBall {
    pub direction: String,
    pub depth: String,
    pub landing_x: f64,
    pub landing_y: f64,
    pub speed_kmh: f64,
    pub spin_type: String,
    pub spin_rpm: f64,
    pub trajectory: Option<Trajectory>,
    pub mistake_type: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ShotResult {
    pub is_mistake: bool,
    pub mistake_type: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Shot {
    pub shot_id: String,
    pub rally_id: i64,
    pub rally_count: i64,
    pub timestamp: String,
    pub time_delta_ms: i64,
    pub phase: String,
    pub stroker: String,
    pub stroke_type: String,
    pub incoming_ball: IncomingBall,
    pub outgoing_ball: OutgoingBall,
    pub result: ShotResult,
}

#[derive(Debug, Deserialize, Clone)]
pub struct PlayerInfo {
    pub name: String,
    pub level: String,
    pub age: i64,
    pub gender: String,
    pub height_cm: f64,
    pub weight_kg: f64,
    pub resting_hr: i64,
    pub max_hr: i64,
    pub training_years: f64,
    pub handedness: String,
    pub backhand_type: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CoachInfo {
    pub name: String,
    pub level: String,
    pub experience_years: i64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct CourtInfo {
    #[serde(rename = "type")]
    pub court_type: String,
    pub indoor: bool,
    pub width_m: f64,
    pub length_m: f64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Phase {
    pub name: String,
    pub duration_min: i64,
    pub shot_count: i64,
    pub pace: String,
    pub focus: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SessionInfo {
    pub session_id: String,
    pub session_index: i64,
    pub date: String,
    pub weekday: String,
    pub duration_minutes: i64,
    pub theme: String,
    pub description: String,
    pub progress_status: String,
    pub days_since_last: i64,
    pub player: PlayerInfo,
    pub coach: CoachInfo,
    pub court: CourtInfo,
    pub phases: Vec<Phase>,
    pub total_rallies: i64,
    pub total_shots: i64,
}

#[derive(Debug, Deserialize, Clone)]
pub struct RawSession {
    pub session: SessionInfo,
    pub shots: Vec<Shot>,
    pub heart_rate: HashMap<String, i64>,
}

const SESSION_01: &str = include_str!("../../tennis_training_data/session_001_20260411/training_data.json");
const SESSION_02: &str = include_str!("../../tennis_training_data/session_002_20260422/training_data.json");
const SESSION_03: &str = include_str!("../../tennis_training_data/session_003_20260508/training_data.json");
const SESSION_04: &str = include_str!("../../tennis_training_data/session_004_20260514/training_data.json");
const SESSION_05: &str = include_str!("../../tennis_training_data/session_005_20260526/training_data.json");
const SESSION_06: &str = include_str!("../../tennis_training_data/session_006_20260604/training_data.json");
const SESSION_07: &str = include_str!("../../tennis_training_data/session_007_20260618/training_data.json");
const SESSION_08: &str = include_str!("../../tennis_training_data/session_008_20260627/training_data.json");

pub fn load_all_sessions() -> Vec<RawSession> {
    let raws = [
        SESSION_01, SESSION_02, SESSION_03, SESSION_04,
        SESSION_05, SESSION_06, SESSION_07, SESSION_08,
    ];
    raws.iter()
        .map(|s| serde_json::from_str(s).expect("failed to parse training data"))
        .collect()
}

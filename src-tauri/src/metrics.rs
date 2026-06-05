use serde::Serialize;
use std::collections::HashMap;

use crate::data::RawSession;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PhaseStat {
    pub phase: String,
    pub shots: i64,
    pub mistakes: i64,
    pub rate: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StrokeStat {
    pub stroke: String,
    pub shots: i64,
    pub mistakes: i64,
    pub rate: f64,
    pub speed: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LandingPoint {
    pub x: f64,
    pub y: f64,
    pub mistake: bool,
    pub stroke: String,
    pub speed: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CurvePointOut {
    pub x: f64,
    pub y: f64,
    pub height_m: f64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrajectoryOut {
    pub points: Vec<CurvePointOut>,
    pub stroke: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionMetric {
    pub id: String,
    pub index: i64,
    pub date: String,
    pub label: String,
    pub theme: String,
    pub status: String,
    pub shots: i64,
    pub rallies: i64,
    pub player_shots: i64,
    pub mistakes: i64,
    pub mistake_rate: f64,
    pub avg_speed: f64,
    pub max_hr: i64,
    pub avg_hr: f64,
    pub avg_spin: f64,
    pub deep_rate: f64,
    pub consistency: f64,
    pub confidence: f64,
    pub rally_length: f64,
    pub phase_stats: Vec<PhaseStat>,
    pub stroke_stats: Vec<StrokeStat>,
    pub landing: Vec<LandingPoint>,
    pub trajectories: Vec<TrajectoryOut>,
}

fn avg(values: &[f64]) -> f64 {
    if values.is_empty() {
        0.0
    } else {
        values.iter().sum::<f64>() / values.len() as f64
    }
}

fn group_by<T, F>(items: &[T], key_fn: F) -> HashMap<String, Vec<&T>>
where
    F: Fn(&T) -> String,
{
    let mut map: HashMap<String, Vec<&T>> = HashMap::new();
    for item in items {
        let name = key_fn(item);
        map.entry(name).or_default().push(item);
    }
    map
}

pub fn build_metric(raw: &RawSession) -> SessionMetric {
    let player_shots: Vec<_> = raw.shots.iter().filter(|s| s.stroker == "player").collect();
    let player_count = player_shots.len() as i64;
    let mistakes = player_shots.iter().filter(|s| s.result.is_mistake).count() as i64;
    let hr_values: Vec<f64> = raw.heart_rate.values().map(|v| *v as f64).collect();

    let mistake_rate = if player_count > 0 {
        mistakes as f64 / player_count as f64
    } else {
        0.0
    };

    let deep_count = player_shots
        .iter()
        .filter(|s| s.outgoing_ball.depth == "深")
        .count() as i64;
    let deep_rate = if player_count > 0 {
        deep_count as f64 / player_count as f64
    } else {
        0.0
    };

    let avg_speed = avg(&player_shots
        .iter()
        .map(|s| s.outgoing_ball.speed_kmh)
        .collect::<Vec<_>>());
    let avg_spin = avg(&player_shots
        .iter()
        .map(|s| s.outgoing_ball.spin_rpm)
        .collect::<Vec<_>>());
    let max_hr = raw.heart_rate.values().max().copied().unwrap_or(0);
    let avg_hr = avg(&hr_values);
    let consistency = 1.0 - mistake_rate;
    let confidence = (0.48 + (1.0 - mistake_rate) * 0.32 + deep_rate * 0.18).min(0.96);
    let rally_length = if raw.session.total_rallies > 0 {
        raw.session.total_shots as f64 / raw.session.total_rallies as f64
    } else {
        0.0
    };

    // stroke stats
    let stroke_groups = group_by(&player_shots, |s| s.stroke_type.clone());
    let mut stroke_stats: Vec<StrokeStat> = stroke_groups
        .iter()
        .map(|(stroke, shots)| {
            let failed = shots.iter().filter(|s| s.result.is_mistake).count() as i64;
            StrokeStat {
                stroke: stroke.clone(),
                shots: shots.len() as i64,
                mistakes: failed,
                rate: failed as f64 / shots.len() as f64,
                speed: avg(&shots
                    .iter()
                    .map(|s| s.outgoing_ball.speed_kmh)
                    .collect::<Vec<_>>()),
            }
        })
        .collect();
    stroke_stats.sort_by(|a, b| a.stroke.cmp(&b.stroke));

    // phase stats
    let phase_groups = group_by(&player_shots, |s| s.phase.clone());
    let mut phase_stats: Vec<PhaseStat> = phase_groups
        .iter()
        .map(|(phase, shots)| {
            let failed = shots.iter().filter(|s| s.result.is_mistake).count() as i64;
            PhaseStat {
                phase: phase.clone(),
                shots: shots.len() as i64,
                mistakes: failed,
                rate: failed as f64 / shots.len() as f64,
            }
        })
        .collect();
    phase_stats.sort_by(|a, b| a.phase.cmp(&b.phase));

    // landing points
    let landing: Vec<LandingPoint> = player_shots
        .iter()
        .map(|s| LandingPoint {
            x: s.outgoing_ball.landing_x,
            y: s.outgoing_ball.landing_y,
            mistake: s.result.is_mistake,
            stroke: s.stroke_type.clone(),
            speed: s.outgoing_ball.speed_kmh,
        })
        .collect();

    // trajectories
    let trajectories: Vec<TrajectoryOut> = player_shots
        .iter()
        .filter_map(|s| {
            s.outgoing_ball.trajectory.as_ref().map(|t| TrajectoryOut {
                points: t
                    .curve_points
                    .iter()
                    .map(|p| CurvePointOut {
                        x: p.x,
                        y: p.y,
                        height_m: p.height_m,
                    })
                    .collect(),
                stroke: s.stroke_type.clone(),
            })
        })
        .take(80)
        .collect();

    SessionMetric {
        id: raw.session.session_id.clone(),
        index: raw.session.session_index,
        date: raw.session.date.clone(),
        label: format!("S{}", raw.session.session_index),
        theme: raw.session.theme.clone(),
        status: raw.session.progress_status.clone(),
        shots: raw.session.total_shots,
        rallies: raw.session.total_rallies,
        player_shots: player_count,
        mistakes,
        mistake_rate,
        avg_speed,
        max_hr,
        avg_hr,
        avg_spin,
        deep_rate,
        consistency,
        confidence,
        rally_length,
        phase_stats,
        stroke_stats,
        landing,
        trajectories,
    }
}

pub fn build_manual_session(
    theme: &str,
    mistake_rate: f64,
    deep_rate: f64,
    avg_speed: f64,
    max_hr: f64,
    index: i64,
    latest: &SessionMetric,
) -> SessionMetric {
    let player_count: i64 = 600;
    let mistakes = (player_count as f64 * mistake_rate).round() as i64;
    let consistency = 1.0 - mistake_rate;
    let confidence = (0.48 + consistency * 0.32 + deep_rate * 0.18).min(0.96);
    let status = if mistake_rate < latest.mistake_rate {
        "突破期"
    } else {
        "巩固期"
    };

    let phase_stats = vec![
        PhaseStat {
            phase: "自主热身".into(),
            shots: 150,
            mistakes: (150.0 * mistake_rate * 0.8).round() as i64,
            rate: mistake_rate * 0.8,
        },
        PhaseStat {
            phase: "专项练习".into(),
            shots: 300,
            mistakes: (300.0 * mistake_rate).round() as i64,
            rate: mistake_rate,
        },
        PhaseStat {
            phase: "模拟比赛".into(),
            shots: 150,
            mistakes: (150.0 * mistake_rate * 1.18).round() as i64,
            rate: mistake_rate * 1.18,
        },
    ];

    let stroke_stats = vec![
        StrokeStat {
            stroke: "正手".into(),
            shots: 320,
            mistakes: (320.0 * mistake_rate * 0.95).round() as i64,
            rate: mistake_rate * 0.95,
            speed: avg_speed,
        },
        StrokeStat {
            stroke: "反手".into(),
            shots: 280,
            mistakes: (280.0 * mistake_rate * 1.06).round() as i64,
            rate: mistake_rate * 1.06,
            speed: avg_speed * 0.94,
        },
    ];

    // Reuse latest landing data with synthetic mistake pattern
    let step = ((1.0 / mistake_rate.max(0.05)).round() as usize).max(3);
    let landing: Vec<LandingPoint> = latest
        .landing
        .iter()
        .take(500)
        .enumerate()
        .map(|(i, p)| LandingPoint {
            x: p.x,
            y: p.y,
            mistake: i % step == 0,
            stroke: p.stroke.clone(),
            speed: p.speed,
        })
        .collect();

    SessionMetric {
        id: format!("manual_{}", chrono_ts()),
        index,
        date: chrono_now(),
        label: format!("S{}", index),
        theme: theme.to_string(),
        status: status.to_string(),
        shots: 1200,
        rallies: 140,
        player_shots: player_count,
        mistakes,
        mistake_rate,
        avg_speed,
        max_hr: max_hr as i64,
        avg_hr: max_hr - 18.0,
        avg_spin: latest.avg_spin,
        deep_rate,
        consistency,
        confidence,
        rally_length: 8.5,
        phase_stats,
        stroke_stats,
        landing,
        trajectories: latest.trajectories.clone(),
    }
}

fn chrono_ts() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis()
}

fn chrono_now() -> String {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let days = ts / 86400;
    let secs_in_day = ts % 86400;
    let hours = secs_in_day / 3600;
    let minutes = (secs_in_day % 3600) / 60;
    let seconds = secs_in_day % 60;
    // Simple epoch-to-date (UTC, good enough for synthetic data)
    let (y, m, d) = epoch_days_to_ymd(days as i64 + 719468);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        y, m, d, hours, minutes, seconds
    )
}

fn epoch_days_to_ymd(mut days: i64) -> (i64, i64, i64) {
    days += 68569;
    let era = if days >= 0 { days } else { days - 146096 } / 146097;
    let doe = days - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

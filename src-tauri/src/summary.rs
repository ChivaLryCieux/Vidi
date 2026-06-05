use serde::Serialize;

use crate::metrics::SessionMetric;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GrowthPoint {
    pub x: f64,
    pub y: f64,
    pub label: String,
    pub index: usize,
    pub status: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub improvement: f64,
    pub best_session_index: usize,
    pub best_session_label: String,
    pub weak_stroke: String,
    pub weak_stroke_rate: f64,
    pub recovery_text: String,
    pub recovery_level: String,
    pub radar_values: [f64; 5],
    pub radar_labels: Vec<String>,
    pub growth_points: Vec<GrowthPoint>,
    pub next_target_rate: f64,
    pub current_deep_rate: f64,
    pub current_rally_length: f64,
    pub current_max_hr: i64,
}

pub fn build_summary(metrics: &[SessionMetric]) -> SessionSummary {
    let first = &metrics[0];
    let latest = &metrics[metrics.len() - 1];

    let improvement = if first.mistake_rate > 0.0 {
        (first.mistake_rate - latest.mistake_rate) / first.mistake_rate
    } else {
        0.0
    };

    // Best session
    let best_idx = metrics
        .iter()
        .enumerate()
        .min_by(|a, b| a.1.mistake_rate.partial_cmp(&b.1.mistake_rate).unwrap())
        .map(|(i, _)| i)
        .unwrap_or(0);

    // Weak stroke
    let weak = latest
        .stroke_stats
        .iter()
        .max_by(|a, b| a.rate.partial_cmp(&b.rate).unwrap())
        .cloned()
        .unwrap_or_else(|| crate::metrics::StrokeStat {
            stroke: String::new(),
            shots: 0,
            mistakes: 0,
            rate: 0.0,
            speed: 0.0,
        });

    // Recovery
    let recovery_level = if latest.max_hr < 150 {
        "强度可控".to_string()
    } else {
        "中高强度".to_string()
    };
    let target_deep = (latest.deep_rate + 0.04).min(0.72);
    let recovery_text = format!(
        "最高心率 {}，回合均长 {:.1} 拍。下一次训练建议把深区落点比例稳定在 {:.0}%。",
        latest.max_hr,
        latest.rally_length,
        target_deep * 100.0
    );

    // Radar
    let radar_values = [
        latest.consistency,
        latest.deep_rate,
        (latest.avg_speed / 95.0).min(1.0),
        (latest.avg_spin / 3200.0).min(1.0),
        latest.confidence,
    ];
    let radar_labels = vec![
        "稳定".to_string(),
        "深区".to_string(),
        "速度".to_string(),
        "旋转".to_string(),
        "信心".to_string(),
    ];

    // Growth chart points
    let points: Vec<f64> = metrics.iter().map(|m| 1.0 - m.mistake_rate).collect();
    let min = points.iter().cloned().fold(f64::INFINITY, f64::min) - 0.02;
    let max = points.iter().cloned().fold(f64::NEG_INFINITY, f64::max) + 0.02;
    let range = max - min;
    let growth_points: Vec<GrowthPoint> = metrics
        .iter()
        .enumerate()
        .map(|(i, m)| {
            let x = 20.0 + (i as f64 / (metrics.len() as f64 - 1.0).max(1.0)) * 260.0;
            let y = 190.0 - ((1.0 - m.mistake_rate - min) / range.max(0.001)) * 150.0;
            GrowthPoint {
                x,
                y,
                label: m.label.clone(),
                index: i,
                status: m.status.clone(),
            }
        })
        .collect();

    // Next target
    let next_target_rate = (latest.mistake_rate - 0.015).max(0.08);

    SessionSummary {
        improvement,
        best_session_index: best_idx,
        best_session_label: metrics[best_idx].label.clone(),
        weak_stroke: weak.stroke,
        weak_stroke_rate: weak.rate,
        recovery_text,
        recovery_level,
        radar_values,
        radar_labels,
        growth_points,
        next_target_rate,
        current_deep_rate: latest.deep_rate,
        current_rally_length: latest.rally_length,
        current_max_hr: latest.max_hr,
    }
}

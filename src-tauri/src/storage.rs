use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use crate::badge::BadgeData;

const BADGES_FILE: &str = "badges.json";
const BADGES_LIMIT: usize = 36;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StoredBadge {
    pub id: String,
    pub timestamp: u64,
    #[serde(flatten)]
    pub data: BadgeData,
}

fn badges_path(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join(BADGES_FILE)
}

pub fn load_badges(app_data_dir: &PathBuf) -> Vec<StoredBadge> {
    let path = badges_path(app_data_dir);
    let Ok(content) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    serde_json::from_str(&content).unwrap_or_default()
}

pub fn save_badge(
    app_data_dir: &PathBuf,
    badge_data: BadgeData,
    mode: &str,
) -> StoredBadge {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let stored = StoredBadge {
        id: format!("{}-{}", timestamp, mode),
        timestamp,
        data: badge_data,
    };

    let mut badges = load_badges(app_data_dir);
    badges.insert(0, stored.clone());
    badges.truncate(BADGES_LIMIT);

    if let Some(parent) = badges_path(app_data_dir).parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(&badges) {
        let _ = fs::write(badges_path(app_data_dir), json);
    }

    stored
}

pub fn delete_badge(app_data_dir: &PathBuf, id: &str) -> bool {
    let mut badges = load_badges(app_data_dir);
    let before = badges.len();
    badges.retain(|b| b.id != id);
    if badges.len() == before {
        return false;
    }
    if let Ok(json) = serde_json::to_string_pretty(&badges) {
        let _ = fs::write(badges_path(app_data_dir), json);
    }
    true
}

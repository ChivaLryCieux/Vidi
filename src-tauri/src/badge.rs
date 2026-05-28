use serde::Serialize;

const TAU: f64 = std::f64::consts::PI * 2.0;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RingPanel {
    pub points: [[f64; 2]; 4],
    pub color: String,
    pub opacity: f64,
    pub front: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BadgeData {
    pub curve_type: String,
    pub merged_points: Vec<[f64; 2]>,
    pub zorder_points: Vec<[f64; 3]>,
    pub ring_panels: Vec<RingPanel>,
    pub color_start: String,
    pub color_end: String,
    pub color_inverted: String,
    pub inverted_pos: f64,
    pub stroke_width: f64,
    pub opacity: f64,
    pub variation: f64,
}

// ── Gosper curve (hexagonal space-filling) ──

fn gosper_curve(iterations: u32) -> Vec<(f64, f64)> {
    // Axiom: A, Rules: A→A-B--B+A++AA+B-, B→+A-BB--B-A++A+B
    let mut stack_str = String::from("A");

    for _ in 0..iterations {
        let mut next = String::new();
        for ch in stack_str.chars() {
            match ch {
                'A' => next.push_str("A-B--B+A++AA+B-"),
                'B' => next.push_str("+A-BB--B-A++A+B"),
                c => next.push(c),
            }
        }
        stack_str = next;
    }

    // Convert L-system string to direction sequence
    let mut dir_seq = vec![0i32]; // start facing right (0 = 0 degrees)
    for ch in stack_str.chars() {
        let last = *dir_seq.last().unwrap();
        match ch {
            '+' => dir_seq.push((last + 1) % 6),
            '-' => dir_seq.push((last + 5) % 6), // -1 mod 6
            _ => dir_seq.push(last),             // A or B: move forward
        }
    }

    // Convert directions to (x, y) points
    let angles = [0.0, 60.0, 120.0, 180.0, 240.0, 300.0];
    let step = 1.0;
    let mut x = 0.0f64;
    let mut y = 0.0f64;
    let mut points = vec![(x, y)];

    for &d in &dir_seq[1..] {
        let rad = angles[d as usize % 6] * std::f64::consts::PI / 180.0;
        x += step * rad.cos();
        y += step * rad.sin();
        points.push((x, y));
    }

    points
}

fn normalize_points(points: &[[f64; 2]], padding: f64) -> Vec<[f64; 2]> {
    let min_x = points.iter().map(|p| p[0]).fold(f64::INFINITY, f64::min);
    let max_x = points
        .iter()
        .map(|p| p[0])
        .fold(f64::NEG_INFINITY, f64::max);
    let min_y = points.iter().map(|p| p[1]).fold(f64::INFINITY, f64::min);
    let max_y = points
        .iter()
        .map(|p| p[1])
        .fold(f64::NEG_INFINITY, f64::max);
    let width = (max_x - min_x).max(1e-10);
    let height = (max_y - min_y).max(1e-10);
    let scale = (1.0 - padding * 2.0) / width.max(height);
    let center_x = (min_x + max_x) * 0.5;
    let center_y = (min_y + max_y) * 0.5;

    points
        .iter()
        .map(|p| {
            [
                (p[0] - center_x) * scale + 0.5,
                (p[1] - center_y) * scale + 0.5,
            ]
        })
        .collect()
}

// ── 3D Z-Order (Morton) curve ──

fn zorder_curve3d(n: usize) -> Vec<(f64, f64, f64)> {
    let mut side = 1u32;
    while (side as usize).pow(3) < n {
        side *= 2;
    }
    let mut points = Vec::with_capacity(n);

    for i in 0..n as u32 {
        // Bit-interleave i into (x, y, z)
        let (mut x, mut y, mut z) = (0u32, 0u32, 0u32);
        let mut val = i;
        let mut bit = 0u32;
        while val > 0 {
            x |= (val & 1) << bit;
            y |= ((val >> 1) & 1) << bit;
            z |= ((val >> 2) & 1) << bit;
            val >>= 3;
            bit += 1;
        }
        let s = side.max(1) as f64;
        points.push((
            (x as f64 + 0.5) / s,
            (y as f64 + 0.5) / s,
            (z as f64 + 0.5) / s,
        ));
    }
    points
}

// ── Hidden rectangular stream rings, adapted from rings.lua ──

#[derive(Clone, Copy)]
struct RingStream {
    radius: f64,
    width: f64,
    z0: f64,
    z1: f64,
    turns: f64,
    phase: f64,
    speed: f64,
    flatness: f64,
    direction: f64,
}

#[derive(Clone, Copy)]
struct RingSensors {
    sound: f64,
    humidity: f64,
    temperature: f64,
}

const RING_STREAMS: [RingStream; 7] = [
    RingStream {
        radius: 13.4,
        width: 0.9,
        z0: -3.2,
        z1: 34.0,
        turns: 1.22,
        phase: 0.18,
        speed: 0.86,
        flatness: 0.235,
        direction: 1.0,
    },
    RingStream {
        radius: 15.2,
        width: 0.42,
        z0: -4.5,
        z1: 35.4,
        turns: 1.15,
        phase: 0.74,
        speed: 0.62,
        flatness: 0.22,
        direction: 1.0,
    },
    RingStream {
        radius: 11.4,
        width: 0.62,
        z0: -1.5,
        z1: 31.0,
        turns: 1.32,
        phase: 2.45,
        speed: 1.08,
        flatness: 0.255,
        direction: -1.0,
    },
    RingStream {
        radius: 16.5,
        width: 0.52,
        z0: -5.6,
        z1: 29.8,
        turns: 1.05,
        phase: 3.1,
        speed: 0.48,
        flatness: 0.2,
        direction: -1.0,
    },
    RingStream {
        radius: 9.3,
        width: 0.28,
        z0: 2.8,
        z1: 28.0,
        turns: 1.52,
        phase: 5.15,
        speed: 1.36,
        flatness: 0.28,
        direction: 1.0,
    },
    RingStream {
        radius: 12.6,
        width: 0.34,
        z0: -5.0,
        z1: 32.5,
        turns: 1.72,
        phase: 4.2,
        speed: 1.52,
        flatness: 0.245,
        direction: -1.0,
    },
    RingStream {
        radius: 17.7,
        width: 0.32,
        z0: -7.2,
        z1: 27.5,
        turns: 0.98,
        phase: 1.92,
        speed: 0.74,
        flatness: 0.19,
        direction: 1.0,
    },
];

const RING_COLORS: [(f64, f64, f64, f64); 9] = [
    (0.0, 0.04, 0.95, 1.0),
    (0.97, 0.98, 0.96, 1.0),
    (0.78, 0.8, 0.8, 1.0),
    (0.28, 0.3, 0.3, 1.0),
    (1.0, 0.9, 0.02, 1.0),
    (0.0, 0.78, 0.88, 1.0),
    (0.02, 0.025, 0.026, 1.0),
    (0.78, 0.8, 1.0, 0.72),
    (1.0, 0.62, 0.86, 0.62),
];

fn smoothstep(value: f64) -> f64 {
    let t = value.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn is_front_angle(angle: f64) -> bool {
    angle.rem_euclid(TAU) <= std::f64::consts::PI
}

fn ring_point(
    stream: RingStream,
    phase: f64,
    u: f64,
    radius_offset: f64,
    text_amount: f64,
) -> (f64, f64, f64) {
    let sway = (u * std::f64::consts::PI * 3.0 + stream.phase).sin() * 0.46;
    let text_clearance = smoothstep(text_amount) * 5.4;
    let radius = stream.radius + text_clearance + radius_offset + sway * 0.14;
    let angle = phase + stream.direction * (u * stream.turns * TAU);
    let z = stream.z0 + (stream.z1 - stream.z0) * u;
    let x = angle.cos() * radius;
    let y = 3.2 - z + angle.sin() * radius * stream.flatness;
    (x, y, angle)
}

fn rgba_color(color: (f64, f64, f64, f64), shade: f64) -> String {
    let r = (color.0 * shade * 255.0).clamp(0.0, 255.0).round();
    let g = (color.1 * shade * 255.0).clamp(0.0, 255.0).round();
    let b = (color.2 * shade * 255.0).clamp(0.0, 255.0).round();
    format!("rgba({r:.0}, {g:.0}, {b:.0}, {:.3})", color.3)
}

fn generate_ring_panels(
    timestamp: i64,
    duration_min: f64,
    total_shots: i64,
    avg_speed: f64,
    avg_apex: f64,
    pure_black: bool,
) -> Vec<RingPanel> {
    let digest = sha256(format!("vidi-hidden-rings:{timestamp}").as_bytes());
    let sensors = RingSensors {
        sound: (total_shots as f64 / 1800.0).clamp(0.0, 1.0),
        humidity: (avg_apex / 3.0).clamp(0.0, 1.0),
        temperature: (avg_speed / 130.0).clamp(0.0, 1.0),
    };
    let spin_phase = digest_unit(&digest, 0) * TAU;
    let flow_amount = (duration_min / 120.0).clamp(0.0, 1.0);
    let text_amount = 0.0;
    let mut raw: Vec<RingPanel> = Vec::new();

    for (stream_index, stream) in RING_STREAMS.iter().enumerate() {
        let phase = stream.phase - spin_phase * stream.speed;
        let panel_count = 42 + (flow_amount * 22.0).floor() as usize;
        for index in 1..=panel_count {
            let group = index / 3;
            let u =
                (index as f64 * 0.137 + stream.phase * 0.07 + flow_amount * 0.08).rem_euclid(1.0);
            let span = 0.018 + (index % 5) as f64 * 0.006 + sensors.sound * 0.012;
            let u0 = (u - span * 0.5).clamp(0.0, 1.0);
            let u1 = (u + span * 0.5).clamp(0.0, 1.0);
            let side = ((index % 4) as f64 - 1.5) * (0.58 + sensors.humidity * 0.4);
            let (x0, y0, a0) = ring_point(*stream, phase, u0, side, text_amount);
            let (x1, y1, a1) = ring_point(*stream, phase, u1, side, text_amount);
            let mid_angle = (a0 + a1) * 0.5;
            let dx = x1 - x0;
            let dy = y1 - y0;
            let length = (dx * dx + dy * dy).sqrt();
            if length < 0.001 {
                continue;
            }
            let nx = -dy / length;
            let ny = dx / length;
            let panel_width =
                stream.width * (0.66 + (index % 4) as f64 * 0.18 + sensors.temperature * 0.24);
            let jitter = (index as f64 * 7.13 + phase * 1.7).sin() * sensors.sound * 0.42;
            let shade = 0.84 + mid_angle.sin() * 0.12;
            let color = if pure_black {
                "rgb(0, 0, 0)".to_string()
            } else {
                rgba_color(RING_COLORS[(group + stream_index) % RING_COLORS.len()], shade)
            };

            raw.push(RingPanel {
                points: [
                    [x0 + nx * panel_width + jitter, y0 + ny * panel_width],
                    [x1 + nx * panel_width + jitter, y1 + ny * panel_width],
                    [
                        x1 - nx * panel_width * 0.35 + jitter,
                        y1 - ny * panel_width * 0.35,
                    ],
                    [
                        x0 - nx * panel_width * 0.35 + jitter,
                        y0 - ny * panel_width * 0.35,
                    ],
                ],
                color,
                opacity: if pure_black {
                    0.82 + digest_unit(&digest, (index + stream_index) % 15) * 0.16
                } else {
                    0.58 + digest_unit(&digest, (index + stream_index) % 15) * 0.28
                },
                front: is_front_angle(mid_angle),
            });
        }
    }

    normalize_ring_panels(raw)
}

fn normalize_ring_panels(mut panels: Vec<RingPanel>) -> Vec<RingPanel> {
    if panels.is_empty() {
        return panels;
    }
    let mut min_x = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    for panel in &panels {
        for point in panel.points {
            min_x = min_x.min(point[0]);
            max_x = max_x.max(point[0]);
            min_y = min_y.min(point[1]);
            max_y = max_y.max(point[1]);
        }
    }
    let cx = (min_x + max_x) * 0.5;
    let cy = (min_y + max_y) * 0.5;
    let mut max_radius: f64 = 0.001;
    for panel in &panels {
        for point in panel.points {
            max_radius = max_radius.max(((point[0] - cx).powi(2) + (point[1] - cy).powi(2)).sqrt());
        }
    }
    let scale = 0.42 / max_radius;
    panels.sort_by_key(|panel| panel.front);
    for panel in &mut panels {
        for point in &mut panel.points {
            point[0] = (point[0] - cx) * scale + 0.5;
            point[1] = (point[1] - cy) * scale + 0.5;
        }
    }
    panels
}

// ── Badge generation ──

fn sha256(input: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut h = [
        0x6a09e667u32,
        0xbb67ae85,
        0x3c6ef372,
        0xa54ff53a,
        0x510e527f,
        0x9b05688c,
        0x1f83d9ab,
        0x5be0cd19,
    ];
    let bit_len = (input.len() as u64) * 8;
    let mut msg = input.to_vec();
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in msg.chunks(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }

        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }
        for (slot, value) in h.iter_mut().zip([a, b, c, d, e, f, g, hh]) {
            *slot = slot.wrapping_add(value);
        }
    }

    let mut out = [0u8; 32];
    for (i, value) in h.iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(&value.to_be_bytes());
    }
    out
}

fn digest_unit(digest: &[u8; 32], index: usize) -> f64 {
    let i = (index * 2) % 30;
    u16::from_be_bytes([digest[i], digest[i + 1]]) as f64 / u16::MAX as f64
}

fn pick_palette(timestamp: i64) -> (String, String, String) {
    // Soft, bounded hue families: mint, aqua, sky, lavender, rose, peach, and fresh gold.
    let digest = sha256(format!("vidi-badge-color:{timestamp}").as_bytes());
    let anchors = [118.0, 152.0, 188.0, 224.0, 262.0, 318.0, 24.0, 48.0];
    let pick = (digest_unit(&digest, 0) * anchors.len() as f64).floor() as usize % anchors.len();
    let hue = (anchors[pick] + (digest_unit(&digest, 1) - 0.5) * 22.0 + 360.0) % 360.0;
    let end_hue = (hue + 16.0 + digest_unit(&digest, 2) * 34.0) % 360.0;
    let accent_hue = (hue + 128.0 + digest_unit(&digest, 3) * 72.0) % 360.0;

    (
        format!(
            "hsl({:.0}, {:.0}%, {:.0}%)",
            hue,
            56.0 + digest_unit(&digest, 4) * 12.0,
            86.0 + digest_unit(&digest, 5) * 6.0
        ),
        format!(
            "hsl({:.0}, {:.0}%, {:.0}%)",
            end_hue,
            52.0 + digest_unit(&digest, 6) * 16.0,
            45.0 + digest_unit(&digest, 7) * 12.0
        ),
        format!(
            "hsl({:.0}, {:.0}%, {:.0}%)",
            accent_hue,
            60.0 + digest_unit(&digest, 8) * 14.0,
            52.0 + digest_unit(&digest, 9) * 12.0
        ),
    )
}

pub fn generate_badge(
    timestamp: i64,
    duration_min: f64,
    total_shots: i64,
    avg_speed: f64,
    avg_apex: f64,
    peak_hr: f64,
) -> BadgeData {
    let (color_start, color_end, color_inverted) = pick_palette(timestamp);

    // Parameter mappings
    let volume = (total_shots as f64 / 2000.0).clamp(0.0, 1.0);
    let stroke_width = 1.4 + volume * 2.4;
    let opacity = 0.72 + (avg_apex / 3.0).clamp(0.0, 1.0) * 0.18;
    let variation = (duration_min / 120.0).min(1.0) * 0.7 + 0.3;
    let inverted_pos = (peak_hr / 200.0).clamp(0.0, 1.0);
    let background_panels =
        generate_ring_panels(timestamp, duration_min, total_shots, avg_speed, avg_apex, false);

    if avg_speed < 80.0 {
        // 2D: Gosper curve only — a single continuous hexagonal path.
        let gosper = gosper_curve(3);
        let duration_factor = (duration_min / 120.0).clamp(0.0, 1.0);
        let amp = 0.04 + duration_factor * 0.16;
        let keep = (36.0 + duration_factor * 196.0).round() as usize;
        let growth = 0.64 + duration_factor * 0.74;
        let rotation = (-42.0 + duration_factor * 186.0).to_radians();
        let cos_r = rotation.cos();
        let sin_r = rotation.sin();
        let phase_seed = digest_unit(
            &sha256(format!("vidi-badge-gosper:{timestamp}").as_bytes()),
            0,
        ) * std::f64::consts::TAU;
        let merged: Vec<[f64; 2]> = gosper
            .iter()
            .take(keep.min(gosper.len()))
            .enumerate()
            .map(|(i, (x, y))| {
                let phase = phase_seed + i as f64 * 0.19;
                let px = (x + phase.sin() * amp) * growth;
                let py = (y + phase.cos() * amp * 0.72) * growth;
                [px * cos_r - py * sin_r, px * sin_r + py * cos_r]
            })
            .collect();
        let merged = normalize_points(&merged, 0.07);

        BadgeData {
            curve_type: "2d".into(),
            merged_points: merged,
            zorder_points: vec![],
            ring_panels: background_panels,
            color_start,
            color_end,
            color_inverted,
            inverted_pos,
            stroke_width,
            opacity,
            variation,
        }
    } else {
        // 3D: Z-Order, fixed to four visible Z units.
        let count = 48;
        let zorder = zorder_curve3d(count);

        BadgeData {
            curve_type: "3d".into(),
            merged_points: vec![],
            zorder_points: zorder.iter().map(|&(x, y, z)| [x, y, z]).collect(),
            ring_panels: background_panels,
            color_start,
            color_end,
            color_inverted,
            inverted_pos,
            stroke_width: (stroke_width * 0.58).max(1.1),
            opacity: (opacity * 0.78).min(0.72),
            variation: 4.0,
        }
    }
}

pub fn generate_hidden_badge(
    timestamp: i64,
    duration_min: f64,
    total_shots: i64,
    avg_speed: f64,
    avg_apex: f64,
    peak_hr: f64,
) -> BadgeData {
    let (color_start, color_end, color_inverted) = pick_palette(timestamp);
    let panels = generate_ring_panels(timestamp, duration_min, total_shots, avg_speed, avg_apex, false);

    BadgeData {
        curve_type: "rings".into(),
        merged_points: vec![],
        zorder_points: vec![],
        ring_panels: panels,
        color_start,
        color_end,
        color_inverted,
        inverted_pos: (peak_hr / 200.0).clamp(0.0, 1.0),
        stroke_width: 1.0,
        opacity: 0.88,
        variation: 7.0,
    }
}

pub fn generate_hidden_black_badge(
    timestamp: i64,
    duration_min: f64,
    total_shots: i64,
    avg_speed: f64,
    avg_apex: f64,
    peak_hr: f64,
) -> BadgeData {
    let panels = generate_ring_panels(timestamp, duration_min, total_shots, avg_speed, avg_apex, true);

    BadgeData {
        curve_type: "ringsBlack".into(),
        merged_points: vec![],
        zorder_points: vec![],
        ring_panels: panels,
        color_start: "rgb(0, 0, 0)".into(),
        color_end: "rgb(0, 0, 0)".into(),
        color_inverted: "rgb(0, 0, 0)".into(),
        inverted_pos: (peak_hr / 200.0).clamp(0.0, 1.0),
        stroke_width: 1.0,
        opacity: 0.96,
        variation: 7.0,
    }
}

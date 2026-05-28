use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BadgeData {
    pub curve_type: String,
    pub hilbert_points: Vec<[f64; 2]>,
    pub gosper_points: Vec<[f64; 2]>,
    pub zorder_points: Vec<[f64; 3]>,
    pub color_start: String,
    pub color_end: String,
    pub color_inverted: String,
    pub inverted_pos: f64,
    pub stroke_width: f64,
    pub opacity: f64,
    pub variation: f64,
}

// ── Hilbert curve (recursive U-shape) ──

fn hilbert_rotate(n: i32, x: &mut i32, y: &mut i32, rx: i32, ry: i32) {
    if ry == 0 {
        if rx == 1 {
            *x = n - 1 - *x;
            *y = n - 1 - *y;
        }
        std::mem::swap(x, y);
    }
}

fn hilbert_curve(order: u32) -> Vec<(f64, f64)> {
    let n = 1i32 << order;
    let total = (n * n) as usize;
    let mut points = Vec::with_capacity(total);
    for d in 0..total as i32 {
        let (mut x, mut y) = (0i32, 0i32);
        let mut s = 1i32;
        let mut t = d;
        while s < n {
            let rx = 1 & (t / 2);
            let ry = 1 & (t ^ rx);
            hilbert_rotate(s, &mut x, &mut y, rx, ry);
            x += s * rx;
            y += s * ry;
            t /= 4;
            s *= 2;
        }
        let fx = (x as f64 + 0.5) / n as f64;
        let fy = (y as f64 + 0.5) / n as f64;
        points.push((fx, fy));
    }
    points
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
            _ => dir_seq.push(last), // A or B: move forward
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

    // Normalize to [0, 1]
    let min_x = points.iter().map(|p| p.0).fold(f64::INFINITY, f64::min);
    let max_x = points.iter().map(|p| p.0).fold(f64::NEG_INFINITY, f64::max);
    let min_y = points.iter().map(|p| p.1).fold(f64::INFINITY, f64::min);
    let max_y = points.iter().map(|p| p.1).fold(f64::NEG_INFINITY, f64::max);
    let range_x = (max_x - min_x).max(1e-10);
    let range_y = (max_y - min_y).max(1e-10);
    let scale = range_x.max(range_y);

    points
        .iter()
        .map(|(px, py)| {
            (
                (px - min_x) / scale * 0.9 + 0.05,
                (py - min_y) / scale * 0.9 + 0.05,
            )
        })
        .collect()
}

// ── 3D Z-Order (Morton) curve ──

fn zorder_curve3d(n: usize) -> Vec<(f64, f64, f64)> {
    let side = (n as f64).powf(1.0 / 3.0).ceil() as u32;
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

// ── Badge generation ──

pub fn generate_badge(
    timestamp: i64,
    duration_min: f64,
    total_shots: i64,
    avg_speed: f64,
    avg_apex: f64,
    peak_hr: f64,
) -> BadgeData {
    // Color from timestamp
    let hue_base = ((timestamp % 360) as f64 + 110.0) % 360.0;
    let hue = 110.0 + (hue_base % 70.0); // green-cyan range [110, 180]
    let color_start = format!("hsl({:.0}, 70%, 85%)", hue);
    let color_end = format!("hsl({:.0}, 75%, 35%)", hue + 20.0);
    let color_inverted = format!("hsl({:.0}, 80%, 50%)", (hue + 180.0) % 360.0);

    // Parameter mappings
    let stroke_width = 1.5 + (total_shots as f64 / 2000.0).min(1.0) * 3.5;
    let opacity = 0.9 + (avg_apex / 3.0).min(1.0) * 0.1;
    let variation = (duration_min / 120.0).min(1.0) * 0.7 + 0.3;
    let inverted_pos = (peak_hr / 200.0).clamp(0.0, 1.0);

    if avg_speed < 80.0 {
        // 2D: Hilbert + Gosper
        let hilbert = hilbert_curve(4); // 16x16 = 256 points
        let gosper = gosper_curve(3);

        // Apply variation as perturbation amplitude
        let amp = variation * 0.015;
        let perturbed_hilbert: Vec<[f64; 2]> = hilbert
            .iter()
            .enumerate()
            .map(|(i, (x, y))| {
                let phase = i as f64 * 0.37;
                [x + phase.sin() * amp, y + phase.cos() * amp]
            })
            .collect();

        let perturbed_gosper: Vec<[f64; 2]> = gosper
            .iter()
            .enumerate()
            .map(|(i, (x, y))| {
                let phase = i as f64 * 0.23;
                [x + phase.cos() * amp, y + phase.sin() * amp]
            })
            .collect();

        BadgeData {
            curve_type: "2d".into(),
            hilbert_points: perturbed_hilbert,
            gosper_points: perturbed_gosper,
            zorder_points: vec![],
            color_start,
            color_end,
            color_inverted,
            inverted_pos,
            stroke_width,
            opacity,
            variation,
        }
    } else {
        // 3D: Z-Order
        let count = 256;
        let zorder = zorder_curve3d(count);

        // Number of overlapping layers from variation
        let layers = (variation * 4.0).round() as usize + 1;

        BadgeData {
            curve_type: "3d".into(),
            hilbert_points: vec![],
            gosper_points: vec![],
            zorder_points: zorder.iter().map(|&(x, y, z)| [x, y, z]).collect(),
            color_start,
            color_end,
            color_inverted,
            inverted_pos,
            stroke_width,
            opacity,
            variation: layers as f64,
        }
    }
}

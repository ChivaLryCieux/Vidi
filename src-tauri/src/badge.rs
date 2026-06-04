use serde::Serialize;

const TAU: f64 = std::f64::consts::PI * 2.0;
const HALF_PI: f64 = std::f64::consts::FRAC_PI_2;

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

// ── SHA-256 (zero-dependency) ──

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
        0x6a09e667u32, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
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
                chunk[i * 4], chunk[i * 4 + 1], chunk[i * 4 + 2], chunk[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16].wrapping_add(s0).wrapping_add(w[i - 7]).wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[i]).wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);
            hh = g; g = f; f = e; e = d.wrapping_add(temp1);
            d = c; c = b; b = a; a = temp1.wrapping_add(temp2);
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

// ── 3D helpers ──

fn rotate_3d(x: f64, y: f64, z: f64, yaw: f64, pitch: f64, roll: f64) -> (f64, f64, f64) {
    let (x1, y1) = (x * roll.cos() - y * roll.sin(), x * roll.sin() + y * roll.cos());
    let (x2, z2) = (x1 * yaw.cos() - z * yaw.sin(), x1 * yaw.sin() + z * yaw.cos());
    let (y3, z3) = (y1 * pitch.cos() - z2 * pitch.sin(), y1 * pitch.sin() + z2 * pitch.cos());
    (x2, y3, z3)
}

/// Blinn-Phong shading: diffuse shade + specular glint baked into HSL.
fn shade_hsl(h: f64, s: f64, l: f64, shade: f64, specular: f64) -> String {
    let mut sl = l * shade;
    let mut ss = s;
    if specular > 0.02 {
        sl += specular.min(1.0) * 28.0;
        ss -= specular.min(1.0) * 20.0;
    }
    format!("hsl({:.0}, {:.0}%, {:.0}%)", h, ss.clamp(0.0, 100.0), sl.clamp(5.0, 98.0))
}

struct SortedPanel {
    panel: RingPanel,
    z_depth: f64,
}

// ── Parametric S-Curve on a Sphere ──
//
// The tennis-ball seam is described in spherical coords by:
//     θ(t) = t
//     φ(t) = π/2 + A₁·sin(2t + ψ₁) + A₂·sin(3t + ψ₂)
//
// where A₁ is the primary S-swing amplitude and A₂ adds a second harmonic
// for more complex interlocking shapes.  By varying A₁, A₂, ψ₁, ψ₂, and
// the sphere radius R we get many unique but all beautifully S-shaped curves.

fn seam_point(t: f64, r: f64, a1: f64, a2: f64, psi1: f64, psi2: f64) -> (f64, f64, f64) {
    let phi = HALF_PI + a1 * (2.0 * t + psi1).sin() + a2 * (3.0 * t + psi2).sin();
    (r * phi.sin() * t.cos(), r * phi.sin() * t.sin(), r * phi.cos())
}

// ── Strand descriptor (compile-time recipe for one ribbon) ──

struct StrandRecipe {
    r: f64,        // sphere radius
    a1: f64,       // primary S amplitude
    a2: f64,       // secondary harmonic amplitude
    psi1: f64,     // primary phase
    psi2: f64,     // secondary phase
    width: f64,    // ribbon width (phi offset)
    color_idx: usize,
    opacity: f64,
    dash_freq: f64, // 0.0 = continuous, >0 = segmented with gaps
}

// ── Main generator ──

pub fn generate_parametric_3d_badge(
    timestamp: i64,
    duration_min: f64,
    total_shots: i64,
    avg_speed: f64,
    avg_apex: f64,
    peak_hr: f64,
    theme: &str,
) -> BadgeData {
    // SHA-256 of all metrics → every badge is a cryptographic fingerprint
    let digest = sha256(
        format!("vidi-seam:{}:{}:{}:{}:{}:{}", timestamp, duration_min, total_shots, avg_speed, avg_apex, peak_hr).as_bytes(),
    );

    // Camera rotation — tied to session data + hash jitter
    let speed_fac = (avg_speed / 130.0).clamp(0.0, 1.0);
    let hr_fac = (peak_hr / 200.0).clamp(0.0, 1.0);
    let yaw   = 0.72 + speed_fac * 0.46 + (digest_unit(&digest, 0) - 0.5) * 0.36;
    let pitch  = 0.48 + hr_fac * 0.28    + (digest_unit(&digest, 1) - 0.5) * 0.26;
    let roll   = -0.10                    + (digest_unit(&digest, 2) - 0.5) * 0.26;

    let d_cam = 24.0;
    let r_base = 8.0;

    // Complexity scaling from training data
    let shots_fac = (total_shots as f64 / 2000.0).clamp(0.0, 1.0);
    let apex_fac  = ((avg_apex - 1.0) / 2.0).clamp(0.0, 1.0);
    let dur_fac   = (duration_min / 120.0).clamp(0.0, 1.0);
    let base_amp  = 0.36 + apex_fac * 0.22;  // primary S swing

    let op_base = match theme { "hidden" => 0.50, "black" => 0.62, _ => 0.80 };
    let op_thin = match theme { "hidden" => 0.60, "black" => 0.74, _ => 0.92 };

    // Palette
    let palette: Vec<(f64, f64, f64)> = match theme {
        "black" => vec![
            (0.0, 0.0, 20.0), (0.0, 0.0, 45.0), (0.0, 0.0, 65.0),
            (0.0, 0.0, 80.0), (0.0, 0.0, 92.0), (0.0, 0.0, 12.0),
        ],
        "hidden" => vec![
            (270.0, 92.0, 80.0), (345.0, 95.0, 80.0), (42.0, 92.0, 76.0),
            (150.0, 85.0, 78.0), (205.0, 95.0, 78.0), (168.0, 90.0, 76.0),
        ],
        _ => vec![
            (190.0, 100.0, 50.0), (50.0, 100.0, 50.0),  (335.0, 100.0, 68.0),
            (165.0, 100.0, 45.0), (210.0, 100.0, 55.0),  (210.0, 30.0, 12.0),
        ],
    };

    // ── Build strand recipes ──
    // Each strand is a parametric S-curve with its own amplitude, phase, radius, and width.
    // The collection produces the interlocking multi-layered tennis-ball seam pattern.
    let mut recipes = Vec::new();

    // Group A: Core structural S-curves (thick, continuous, diverse radii)
    let n_core = 4 + (shots_fac * 3.0).round() as usize; // 4..7
    for i in 0..n_core {
        let d = digest_unit(&digest, (i * 3) % 15);
        recipes.push(StrandRecipe {
            r: r_base + (d - 0.5) * 1.2,
            a1: base_amp + (d - 0.5) * 0.12,
            a2: 0.0,
            psi1: d * TAU,
            psi2: 0.0,
            width: 0.14 + dur_fac * 0.06,
            color_idx: i % palette.len(),
            opacity: op_base,
            dash_freq: 0.0,
        });
    }

    // Group B: Counter-phase interlocking S-curves (medium, creates the weaving illusion)
    let n_weave = 4 + (shots_fac * 4.0).round() as usize; // 4..8
    for i in 0..n_weave {
        let d = digest_unit(&digest, (i * 5 + 3) % 15);
        recipes.push(StrandRecipe {
            r: r_base + (d - 0.5) * 1.8,
            a1: base_amp + (d - 0.5) * 0.18,
            a2: 0.06 + d * 0.08,
            psi1: d * TAU + std::f64::consts::PI, // counter-phase!
            psi2: d * TAU * 0.7,
            width: 0.07 + dur_fac * 0.03,
            color_idx: (i + 2) % palette.len(),
            opacity: op_base * 1.1,
            dash_freq: 0.0,
        });
    }

    // Group C: Thin accent wireframe S-lines (elegant, some dashed)
    let n_accent = 5 + (shots_fac * 5.0).round() as usize; // 5..10
    for i in 0..n_accent {
        let d = digest_unit(&digest, (i * 7 + 6) % 15);
        recipes.push(StrandRecipe {
            r: r_base + (d - 0.5) * 2.4,
            a1: base_amp + (d - 0.5) * 0.24,
            a2: d * 0.12,
            psi1: d * TAU * 1.4,
            psi2: d * TAU * 0.3,
            width: 0.012 + d * 0.012,
            color_idx: (i + 4) % palette.len(),
            opacity: op_thin,
            dash_freq: if i % 3 == 0 { 5.0 + d * 4.0 } else { 0.0 },
        });
    }

    // Group D: Ultra-thin hairline guides (very subtle, scattered at extreme radii)
    let n_hair = 3 + (shots_fac * 3.0).round() as usize; // 3..6
    for i in 0..n_hair {
        let d = digest_unit(&digest, (i * 11 + 9) % 15);
        recipes.push(StrandRecipe {
            r: r_base + (d - 0.5) * 3.0,
            a1: base_amp + (d - 0.5) * 0.30,
            a2: d * 0.06,
            psi1: d * TAU * 2.1,
            psi2: d * TAU * 1.6,
            width: 0.005 + d * 0.005,
            color_idx: (i + 1) % palette.len(),
            opacity: 0.35 + d * 0.20,
            dash_freq: 7.0 + d * 6.0,
        });
    }

    let steps = 360; // angular resolution of the full closed loop
    let dt = TAU / steps as f64;

    let mut sorted: Vec<SortedPanel> = Vec::new();

    // ── HUD watermark grid (ultrathin concentric guide circles) ──
    let hud_color = if theme == "black" {
        (0.0, 0.0, 25.0)
    } else {
        (210.0, 10.0, 80.0)
    };
    for ring_i in 0..3 {
        let cr = r_base * (0.92 + ring_i as f64 * 0.06);
        let tilt = ring_i as f64 * 0.28;
        for k in 0..72 {
            let t0 = k as f64 * (TAU / 72.0);
            let t1 = t0 + TAU / 72.0;
            let v0 = (cr * t0.cos(), cr * t0.sin() * tilt.cos(), cr * t0.sin() * tilt.sin());
            let v1 = (cr * t1.cos(), cr * t1.sin() * tilt.cos(), cr * t1.sin() * tilt.sin());
            let rv0 = rotate_3d(v0.0, v0.1, v0.2, yaw, pitch, roll);
            let rv1 = rotate_3d(v1.0, v1.1, v1.2, yaw, pitch, roll);
            let z_avg = (rv0.2 + rv1.2) * 0.5;
            let proj = |p: (f64, f64, f64)| { let f = d_cam / (d_cam - p.2); [p.0 * f, p.1 * f] };
            let a = proj(rv0);
            let b = proj(rv1);
            let dw = 0.006;
            sorted.push(SortedPanel {
                panel: RingPanel {
                    points: [[a[0]-dw,a[1]-dw],[b[0]-dw,b[1]-dw],[b[0]+dw,b[1]+dw],[a[0]+dw,a[1]+dw]],
                    color: shade_hsl(hud_color.0, hud_color.1, hud_color.2, 1.0, 0.0),
                    opacity: 0.18,
                    front: z_avg >= 0.0,
                },
                z_depth: z_avg - 0.3,
            });
        }
    }

    // ── Generate ribbon panels for every strand recipe ──
    for (_si, recipe) in recipes.iter().enumerate() {
        let base_hsl = palette[recipe.color_idx];

        for k in 0..steps {
            let t0 = k as f64 * dt;
            let t1 = t0 + dt;

            // Dashed segments: skip if inside a gap
            if recipe.dash_freq > 0.0 && (recipe.dash_freq * t0).cos() < -0.45 {
                continue;
            }

            let half_w = recipe.width * 0.5;

            // Quad corners: offset the phi angle ±half_w from the seam center line
            let phi0_center = HALF_PI + recipe.a1 * (2.0 * t0 + recipe.psi1).sin() + recipe.a2 * (3.0 * t0 + recipe.psi2).sin();
            let phi1_center = HALF_PI + recipe.a1 * (2.0 * t1 + recipe.psi1).sin() + recipe.a2 * (3.0 * t1 + recipe.psi2).sin();

            let r = recipe.r;
            let make_pt = |t: f64, phi: f64| (r * phi.sin() * t.cos(), r * phi.sin() * t.sin(), r * phi.cos());

            let v0 = make_pt(t0, phi0_center - half_w);
            let v1 = make_pt(t1, phi1_center - half_w);
            let v2 = make_pt(t1, phi1_center + half_w);
            let v3 = make_pt(t0, phi0_center + half_w);

            let rv0 = rotate_3d(v0.0, v0.1, v0.2, yaw, pitch, roll);
            let rv1 = rotate_3d(v1.0, v1.1, v1.2, yaw, pitch, roll);
            let rv2 = rotate_3d(v2.0, v2.1, v2.2, yaw, pitch, roll);
            let rv3 = rotate_3d(v3.0, v3.1, v3.2, yaw, pitch, roll);

            let z_avg = (rv0.2 + rv1.2 + rv2.2 + rv3.2) * 0.25;

            let proj = |p: (f64, f64, f64)| { let f = d_cam / (d_cam - p.2); [p.0 * f, p.1 * f] };

            // Diffuse normal
            let (dx1, dy1, dz1) = (rv1.0 - rv0.0, rv1.1 - rv0.1, rv1.2 - rv0.2);
            let (dx2, dy2, dz2) = (rv3.0 - rv0.0, rv3.1 - rv0.1, rv3.2 - rv0.2);
            let (nx, ny, nz) = (dy1*dz2 - dz1*dy2, dz1*dx2 - dx1*dz2, dx1*dy2 - dy1*dx2);
            let nlen = (nx*nx + ny*ny + nz*nz).sqrt().max(1e-6);
            let (nx, ny, nz) = (nx/nlen, ny/nlen, nz/nlen);

            let min_diff = if theme == "hidden" { 0.72 } else { 0.20 };
            let diffuse = (0.60 + 0.40 * (nx*0.577 + ny*0.577 + nz*0.577).clamp(-1.0, 1.0)).max(min_diff);
            let spec_dot = nx * 0.325 + ny * 0.325 + nz * 0.888;
            let specular = spec_dot.max(0.0).powi(14);

            // Cometary trail fade along the loop
            let progress = k as f64 / steps as f64;
            let hue = (base_hsl.0 + progress * 24.0).rem_euclid(360.0);
            let mut lit = base_hsl.2 - progress * 8.0;
            if theme == "hidden" && lit < 75.0 {
                lit = 75.0;
            }
            let fade = 1.0 - progress * 0.55; // opacity fades towards the tail

            let color = shade_hsl(hue, base_hsl.1, lit, diffuse, specular);

            sorted.push(SortedPanel {
                panel: RingPanel {
                    points: [proj(rv0), proj(rv1), proj(rv2), proj(rv3)],
                    color,
                    opacity: (recipe.opacity * fade).clamp(0.05, 1.0),
                    front: z_avg >= 0.0,
                },
                z_depth: z_avg,
            });
        }

        // Node sparkle at the "tip" (halfway around the loop for visual balance)
        let tip = seam_point(std::f64::consts::PI, recipe.r, recipe.a1, recipe.a2, recipe.psi1, recipe.psi2);
        let rt = rotate_3d(tip.0, tip.1, tip.2, yaw, pitch, roll);
        let f = d_cam / (d_cam - rt.2);
        let (cx, cy) = (rt.0 * f, rt.1 * f);
        let ds = 0.04 + shots_fac * 0.03;
        let mut node_lit = base_hsl.2;
        if theme == "hidden" && node_lit < 75.0 {
            node_lit = 75.0;
        }
        sorted.push(SortedPanel {
            panel: RingPanel {
                points: [[cx-ds,cy-ds],[cx+ds,cy-ds],[cx+ds,cy+ds],[cx-ds,cy+ds]],
                color: shade_hsl(base_hsl.0, base_hsl.1, node_lit, 1.4, 0.0),
                opacity: 0.96,
                front: rt.2 >= 0.0,
            },
            z_depth: rt.2 + 0.1,
        });
    }

    // ── Efficiency orbital rings ──
    let efficiency = (avg_speed / peak_hr.max(60.0)).clamp(0.2, 1.8);
    let n_orbits = if total_shots > 1200 { 2 } else { 1 };
    for o in 0..n_orbits {
        let or = r_base * (1.12 + o as f64 * 0.08);
        let ecc = if efficiency > 0.8 { 1.0 } else { 1.0 - (0.8 - efficiency) * 0.6 };
        let tilt = yaw + 0.45 * (o as f64 + 1.0) * efficiency;
        let oc = palette[o % palette.len()];
        let mut orbit_lit = oc.2;
        if theme == "hidden" && orbit_lit < 75.0 {
            orbit_lit = 75.0;
        }
        for k in 0..90 {
            let t0 = k as f64 * (TAU / 90.0);
            let t1 = t0 + TAU / 90.0;
            let v0 = (or*t0.cos(), or*t0.sin()*ecc*tilt.cos(), or*t0.sin()*ecc*tilt.sin());
            let v1 = (or*t1.cos(), or*t1.sin()*ecc*tilt.cos(), or*t1.sin()*ecc*tilt.sin());
            let rv0 = rotate_3d(v0.0, v0.1, v0.2, yaw, pitch, roll);
            let rv1 = rotate_3d(v1.0, v1.1, v1.2, yaw, pitch, roll);
            let z_avg = (rv0.2 + rv1.2) * 0.5;
            let proj = |p: (f64, f64, f64)| { let f = d_cam / (d_cam - p.2); [p.0 * f, p.1 * f] };
            let a = proj(rv0);
            let b = proj(rv1);
            let dw = 0.018 + shots_fac * 0.016;
            sorted.push(SortedPanel {
                panel: RingPanel {
                    points: [[a[0]-dw,a[1]-dw],[b[0]-dw,b[1]-dw],[b[0]+dw,b[1]+dw],[a[0]+dw,a[1]+dw]],
                    color: shade_hsl(oc.0, oc.1, orbit_lit, 1.1, 0.4),
                    opacity: 0.72 + shots_fac * 0.2,
                    front: z_avg >= 0.0,
                },
                z_depth: z_avg + 0.15,
            });
        }
    }

    // ── Painter's depth sort (back → front) ──
    sorted.sort_by(|a, b| a.z_depth.partial_cmp(&b.z_depth).unwrap());
    let panels: Vec<RingPanel> = sorted.into_iter().map(|s| s.panel).collect();

    // ── Normalize to [0,1] coordinate space ──
    let mut panels = panels;
    if !panels.is_empty() {
        let (mut min_x, mut max_x) = (f64::INFINITY, f64::NEG_INFINITY);
        let (mut min_y, mut max_y) = (f64::INFINITY, f64::NEG_INFINITY);
        for p in &panels {
            for pt in p.points {
                min_x = min_x.min(pt[0]); max_x = max_x.max(pt[0]);
                min_y = min_y.min(pt[1]); max_y = max_y.max(pt[1]);
            }
        }
        let cx = (min_x + max_x) * 0.5;
        let cy = (min_y + max_y) * 0.5;
        let mut max_r = 1e-6_f64;
        for p in &panels {
            for pt in p.points {
                max_r = max_r.max(((pt[0] - cx).powi(2) + (pt[1] - cy).powi(2)).sqrt());
            }
        }
        let scale = 0.42 / max_r;
        for p in &mut panels {
            for pt in &mut p.points {
                pt[0] = (pt[0] - cx) * scale + 0.5;
                pt[1] = (pt[1] - cy) * scale + 0.5;
            }
        }
    }

    let c0 = palette[0];
    let c2 = palette[2];
    BadgeData {
        curve_type: "parametric3d".into(),
        merged_points: vec![],
        zorder_points: vec![],
        ring_panels: panels,
        color_start: format!("hsl({:.0}, {:.0}%, {:.0}%)", c0.0, c0.1, c0.2),
        color_end:   format!("hsl({:.0}, {:.0}%, {:.0}%)", c2.0, c2.1, c2.2),
        color_inverted: "rgb(255,255,255)".into(),
        inverted_pos: hr_fac,
        stroke_width: 1.0 + shots_fac * 2.0,
        opacity: op_base,
        variation: base_amp * 10.0,
    }
}

// ── Public entry points (called by commands.rs) ──

pub fn generate_badge(timestamp: i64, duration_min: f64, total_shots: i64, avg_speed: f64, avg_apex: f64, peak_hr: f64) -> BadgeData {
    generate_parametric_3d_badge(timestamp, duration_min, total_shots, avg_speed, avg_apex, peak_hr, "standard")
}

pub fn generate_hidden_badge(timestamp: i64, duration_min: f64, total_shots: i64, avg_speed: f64, avg_apex: f64, peak_hr: f64) -> BadgeData {
    generate_parametric_3d_badge(timestamp, duration_min, total_shots, avg_speed, avg_apex, peak_hr, "hidden")
}

pub fn generate_hidden_black_badge(timestamp: i64, duration_min: f64, total_shots: i64, avg_speed: f64, avg_apex: f64, peak_hr: f64) -> BadgeData {
    generate_parametric_3d_badge(timestamp, duration_min, total_shots, avg_speed, avg_apex, peak_hr, "black")
}

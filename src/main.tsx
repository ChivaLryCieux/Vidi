import React from "react";
import ReactDOM from "react-dom/client";
import { Activity, ArrowDownUp, Dumbbell, Grid2X2, LineChart, Plus, Radar, Sparkles, Target, Trophy } from "lucide-react";
import s1 from "../tennis_training_data/session_001_20260411/training_data.json";
import s2 from "../tennis_training_data/session_002_20260422/training_data.json";
import s3 from "../tennis_training_data/session_003_20260508/training_data.json";
import s4 from "../tennis_training_data/session_004_20260514/training_data.json";
import s5 from "../tennis_training_data/session_005_20260526/training_data.json";
import s6 from "../tennis_training_data/session_006_20260604/training_data.json";
import s7 from "../tennis_training_data/session_007_20260618/training_data.json";
import s8 from "../tennis_training_data/session_008_20260627/training_data.json";
import "./styles.css";

type Shot = {
  shot_id: string;
  phase: string;
  stroker: "coach" | "player";
  stroke_type: string;
  time_delta_ms: number;
  incoming_ball: { speed_kmh: number; spin_rpm: number };
  outgoing_ball: {
    direction: string;
    depth: string;
    landing_x: number;
    landing_y: number;
    speed_kmh: number;
    spin_rpm: number;
    trajectory: null | { apex_height_m: number; curve_points: { x: number; y: number; height_m: number }[] };
  };
  result: { is_mistake: boolean; mistake_type: string | null };
};

type RawSession = {
  session: {
    session_id: string;
    session_index: number;
    date: string;
    duration_minutes: number;
    theme: string;
    description: string;
    progress_status: string;
    days_since_last: number;
    total_rallies: number;
    total_shots: number;
  };
  shots: Shot[];
  heart_rate: Record<string, number>;
};

type SessionMetric = {
  id: string;
  index: number;
  date: string;
  label: string;
  theme: string;
  status: string;
  shots: number;
  rallies: number;
  playerShots: number;
  mistakes: number;
  mistakeRate: number;
  avgSpeed: number;
  maxHr: number;
  avgHr: number;
  avgSpin: number;
  deepRate: number;
  consistency: number;
  confidence: number;
  rallyLength: number;
  phaseStats: { phase: string; shots: number; mistakes: number; rate: number }[];
  strokeStats: { stroke: string; shots: number; mistakes: number; rate: number; speed: number }[];
  landing: { x: number; y: number; mistake: boolean; stroke: string; speed: number }[];
  trajectories: { points: { x: number; y: number; height_m: number }[]; stroke: string }[];
};

const rawSessions = [s1, s2, s3, s4, s5, s6, s7, s8] as RawSession[];

const accent = "#80372b";

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function pct(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function cnDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((map, item) => {
    const name = key(item);
    map[name] = map[name] || [];
    map[name].push(item);
    return map;
  }, {});
}

function buildMetric(raw: RawSession): SessionMetric {
  const playerShots = raw.shots.filter((shot) => shot.stroker === "player");
  const mistakes = playerShots.filter((shot) => shot.result.is_mistake).length;
  const hrValues = Object.values(raw.heart_rate);
  const strokeStats = Object.entries(groupBy(playerShots, (shot) => shot.stroke_type)).map(([stroke, shots]) => {
    const failed = shots.filter((shot) => shot.result.is_mistake).length;
    return {
      stroke,
      shots: shots.length,
      mistakes: failed,
      rate: failed / shots.length,
      speed: avg(shots.map((shot) => shot.outgoing_ball.speed_kmh)),
    };
  });
  const phaseStats = Object.entries(groupBy(playerShots, (shot) => shot.phase)).map(([phase, shots]) => {
    const failed = shots.filter((shot) => shot.result.is_mistake).length;
    return { phase, shots: shots.length, mistakes: failed, rate: failed / shots.length };
  });
  const mistakeRate = mistakes / playerShots.length;
  const deepRate = playerShots.filter((shot) => shot.outgoing_ball.depth === "深").length / playerShots.length;
  return {
    id: raw.session.session_id,
    index: raw.session.session_index,
    date: raw.session.date,
    label: `S${raw.session.session_index}`,
    theme: raw.session.theme,
    status: raw.session.progress_status,
    shots: raw.session.total_shots,
    rallies: raw.session.total_rallies,
    playerShots: playerShots.length,
    mistakes,
    mistakeRate,
    avgSpeed: avg(playerShots.map((shot) => shot.outgoing_ball.speed_kmh)),
    maxHr: Math.max(...hrValues),
    avgHr: avg(hrValues),
    avgSpin: avg(playerShots.map((shot) => shot.outgoing_ball.spin_rpm)),
    deepRate,
    consistency: 1 - mistakeRate,
    confidence: Math.min(0.96, 0.48 + (1 - mistakeRate) * 0.32 + deepRate * 0.18),
    rallyLength: raw.session.total_shots / raw.session.total_rallies,
    phaseStats,
    strokeStats,
    landing: playerShots.map((shot) => ({
      x: shot.outgoing_ball.landing_x,
      y: shot.outgoing_ball.landing_y,
      mistake: shot.result.is_mistake,
      stroke: shot.stroke_type,
      speed: shot.outgoing_ball.speed_kmh,
    })),
    trajectories: playerShots
      .filter((shot) => shot.outgoing_ball.trajectory)
      .slice(0, 80)
      .map((shot) => ({ points: shot.outgoing_ball.trajectory!.curve_points, stroke: shot.stroke_type })),
  };
}

const baseMetrics = rawSessions.map(buildMetric);

const navItems = [
  { id: "overview", label: "总览", icon: Grid2X2 },
  { id: "growth", label: "成长", icon: LineChart },
  { id: "court", label: "球场", icon: Target },
  { id: "load", label: "负荷", icon: Activity },
  { id: "input", label: "录入", icon: Plus },
] as const;

type ViewId = (typeof navItems)[number]["id"];

function App() {
  const [view, setView] = React.useState<ViewId>("overview");
  const [selected, setSelected] = React.useState(baseMetrics.length - 1);
  const [manualSessions, setManualSessions] = React.useState<SessionMetric[]>([]);
  const metrics = [...baseMetrics, ...manualSessions];
  const current = metrics[selected] || metrics[metrics.length - 1];
  const first = metrics[0];
  const latest = metrics[metrics.length - 1];
  const improvement = (first.mistakeRate - latest.mistakeRate) / first.mistakeRate;

  function addManualSession(form: FormData) {
    const rate = Number(form.get("mistakeRate")) / 100;
    const deep = Number(form.get("deepRate")) / 100;
    const speed = Number(form.get("avgSpeed"));
    const nextIndex = metrics.length + 1;
    const synthetic: SessionMetric = {
      id: `manual_${Date.now()}`,
      index: nextIndex,
      date: new Date().toISOString(),
      label: `S${nextIndex}`,
      theme: String(form.get("theme") || "自主训练"),
      status: rate < latest.mistakeRate ? "突破期" : "巩固期",
      shots: 1200,
      rallies: 140,
      playerShots: 600,
      mistakes: Math.round(600 * rate),
      mistakeRate: rate,
      avgSpeed: speed,
      maxHr: Number(form.get("maxHr")),
      avgHr: Number(form.get("maxHr")) - 18,
      avgSpin: latest.avgSpin,
      deepRate: deep,
      consistency: 1 - rate,
      confidence: Math.min(0.96, 0.48 + (1 - rate) * 0.32 + deep * 0.18),
      rallyLength: 8.5,
      phaseStats: [
        { phase: "自主热身", shots: 150, mistakes: Math.round(150 * rate * 0.8), rate: rate * 0.8 },
        { phase: "专项练习", shots: 300, mistakes: Math.round(300 * rate), rate },
        { phase: "模拟比赛", shots: 150, mistakes: Math.round(150 * rate * 1.18), rate: rate * 1.18 },
      ],
      strokeStats: [
        { stroke: "正手", shots: 320, mistakes: Math.round(320 * rate * 0.95), rate: rate * 0.95, speed },
        { stroke: "反手", shots: 280, mistakes: Math.round(280 * rate * 1.06), rate: rate * 1.06, speed: speed * 0.94 },
      ],
      landing: latest.landing.slice(0, 500).map((point, i) => ({
        ...point,
        mistake: i % Math.max(3, Math.round(1 / Math.max(rate, 0.05))) === 0,
      })),
      trajectories: latest.trajectories,
    };
    setManualSessions((items) => [...items, synthetic]);
    setSelected(metrics.length);
    setView("overview");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="kicker">Vidi Tennis Intelligence</p>
          <h1>Vidi</h1>
        </div>
        <div className="mark" aria-label="Vidi mark">V</div>
      </header>

      <section className="hero-strip">
        <div>
          <span>半年度成长叙事</span>
          <strong>{pct(improvement)} 失误率改善</strong>
        </div>
        <Sparkles size={28} />
      </section>

      <SessionRail metrics={metrics} selected={selected} onSelect={setSelected} />

      <section className="view-frame">
        {view === "overview" && <Overview current={current} first={first} latest={latest} metrics={metrics} />}
        {view === "growth" && <Growth metrics={metrics} selected={selected} onSelect={setSelected} />}
        {view === "court" && <CourtView current={current} />}
        {view === "load" && <LoadView current={current} metrics={metrics} />}
        {view === "input" && <InputView onAdd={addManualSession} latest={latest} />}
      </section>

      <nav className="bottom-nav" aria-label="主导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)} type="button">
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}

function SessionRail({ metrics, selected, onSelect }: { metrics: SessionMetric[]; selected: number; onSelect: (value: number) => void }) {
  return (
    <div className="session-rail" aria-label="训练场次">
      {metrics.map((metric, index) => (
        <button key={metric.id} className={index === selected ? "active" : ""} onClick={() => onSelect(index)} type="button">
          <span>{metric.label}</span>
          <small>{cnDate(metric.date)}</small>
        </button>
      ))}
    </div>
  );
}

function Overview({ current, first, latest, metrics }: { current: SessionMetric; first: SessionMetric; latest: SessionMetric; metrics: SessionMetric[] }) {
  const best = metrics.reduce((winner, item) => (item.mistakeRate < winner.mistakeRate ? item : winner), metrics[0]);
  return (
    <div className="grid-view">
      <Card className="summary-card">
        <div className="card-title">
          <span>{current.theme}</span>
          <strong>{current.status}</strong>
        </div>
        <div className="big-metric">{pct(current.confidence)}</div>
        <p className="muted">自我效能指数。由稳定性、深区控制与训练强度综合估算。</p>
        <div className="metric-row">
          <MiniStat label="失误率" value={pct(current.mistakeRate)} />
          <MiniStat label="深区球" value={pct(current.deepRate)} />
          <MiniStat label="均速" value={`${Math.round(current.avgSpeed)} km/h`} />
        </div>
      </Card>
      <Card>
        <div className="card-title">
          <span>成长曲线</span>
          <Trophy size={20} />
        </div>
        <Sparkline metrics={metrics} />
        <div className="annotation">
          <strong>{best.label} 是当前突破点</strong>
          <span>相对首次训练，最近一次失误率从 {pct(first.mistakeRate)} 到 {pct(latest.mistakeRate)}。</span>
        </div>
      </Card>
      <Card>
        <div className="card-title">
          <span>技术雷达</span>
          <Radar size={20} />
        </div>
        <RadarChart metric={current} />
      </Card>
      <Card>
        <div className="card-title">
          <span>行动焦点</span>
          <Dumbbell size={20} />
        </div>
        <ActionList metric={current} />
      </Card>
    </div>
  );
}

function Growth({ metrics, selected, onSelect }: { metrics: SessionMetric[]; selected: number; onSelect: (value: number) => void }) {
  const points = metrics.map((metric) => 1 - metric.mistakeRate);
  const min = Math.min(...points) - 0.02;
  const max = Math.max(...points) + 0.02;
  const coords = metrics.map((metric, index) => {
    const x = 20 + (index / Math.max(metrics.length - 1, 1)) * 260;
    const y = 190 - ((1 - metric.mistakeRate - min) / (max - min)) * 150;
    return { x, y, metric, index };
  });
  return (
    <div className="grid-view">
      <Card className="wide-card">
        <div className="card-title">
          <span>能力阶梯</span>
          <LineChart size={20} />
        </div>
        <svg className="growth-chart" viewBox="0 0 320 220" role="img" aria-label="训练稳定性趋势">
          <path d="M20 195H300 M20 45H300 M20 95H300 M20 145H300" className="grid-line" />
          <polyline points={coords.map((p) => `${p.x},${p.y}`).join(" ")} className="trend-line" />
          {coords.map((point) => (
            <g key={point.metric.id} onClick={() => onSelect(point.index)} className="chart-point">
              <circle cx={point.x} cy={point.y} r={selected === point.index ? 8 : 5} className={point.metric.status === "突破期" ? "breakthrough" : ""} />
              <text x={point.x} y={210} textAnchor="middle">{point.metric.label}</text>
            </g>
          ))}
        </svg>
      </Card>
      {metrics.map((metric, index) => (
        <button key={metric.id} className={`timeline-card ${index === selected ? "active" : ""}`} onClick={() => onSelect(index)} type="button">
          <span>{metric.label}</span>
          <strong>{metric.theme}</strong>
          <small>{metric.status} / 稳定性 {pct(metric.consistency)}</small>
        </button>
      ))}
    </div>
  );
}

function CourtView({ current }: { current: SessionMetric }) {
  const points = current.landing.filter((_, index) => index % 3 === 0).slice(0, 240);
  return (
    <div className="grid-view">
      <Card className="wide-card">
        <div className="card-title">
          <span>落点地图</span>
          <Target size={20} />
        </div>
        <div className="court">
          <div className="court-line net" />
          <div className="court-line service-a" />
          <div className="court-line service-b" />
          <div className="court-line center" />
          {points.map((point, index) => (
            <span
              key={`${point.x}-${point.y}-${index}`}
              className={`landing ${point.mistake ? "mistake" : ""}`}
              style={{ left: `${((point.x + 5.5) / 11) * 100}%`, top: `${((11.9 - point.y) / 23.8) * 100}%` }}
              title={`${point.stroke} ${Math.round(point.speed)}km/h`}
            />
          ))}
        </div>
        <div className="legend">
          <span><i /> 有效落点</span>
          <span><i className="mistake" /> 失误点</span>
        </div>
      </Card>
      <Card>
        <div className="card-title">
          <span>3D 轨迹感知</span>
          <ArrowDownUp size={20} />
        </div>
        <TrajectoryStack trajectories={current.trajectories.slice(0, 18)} />
      </Card>
      <Card>
        <div className="card-title">
          <span>击球类型</span>
          <span>{current.playerShots} 拍</span>
        </div>
        {current.strokeStats.map((stroke) => (
          <Bar key={stroke.stroke} label={stroke.stroke} value={1 - stroke.rate} sub={`均速 ${Math.round(stroke.speed)} km/h`} />
        ))}
      </Card>
    </div>
  );
}

function LoadView({ current, metrics }: { current: SessionMetric; metrics: SessionMetric[] }) {
  return (
    <div className="grid-view">
      <Card className="wide-card">
        <div className="card-title">
          <span>训练负荷矩阵</span>
          <Activity size={20} />
        </div>
        <div className="load-grid">
          {metrics.map((metric) => (
            <div
              key={metric.id}
              className={metric.id === current.id ? "active" : ""}
              style={{
                height: `${42 + metric.maxHr * 0.42}px`,
                opacity: 0.52 + metric.confidence * 0.45,
              }}
            >
              <span>{metric.label}</span>
              <strong>{metric.maxHr}</strong>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <div className="card-title">
          <span>阶段压力</span>
          <span>{current.theme}</span>
        </div>
        {current.phaseStats.map((phase) => (
          <Bar key={phase.phase} label={phase.phase} value={1 - phase.rate} sub={`${phase.shots} 拍 / 失误 ${pct(phase.rate)}`} />
        ))}
      </Card>
      <Card>
        <div className="card-title">
          <span>恢复信号</span>
          <span>{Math.round(current.avgHr)} BPM</span>
        </div>
        <div className="recovery">
          <strong>{current.maxHr < 150 ? "强度可控" : "中高强度"}</strong>
          <p>最高心率 {current.maxHr}，回合均长 {current.rallyLength.toFixed(1)} 拍。下一次训练建议把深区落点比例稳定在 {pct(Math.min(current.deepRate + 0.04, 0.72))}。</p>
        </div>
      </Card>
    </div>
  );
}

function InputView({ onAdd, latest }: { onAdd: (form: FormData) => void; latest: SessionMetric }) {
  return (
    <div className="grid-view">
      <Card className="wide-card">
        <div className="card-title">
          <span>新增训练数据</span>
          <Plus size={20} />
        </div>
        <form
          className="data-form"
          onSubmit={(event) => {
            event.preventDefault();
            onAdd(new FormData(event.currentTarget));
            event.currentTarget.reset();
          }}
        >
          <label>
            训练主题
            <input name="theme" defaultValue="自主训练" />
          </label>
          <label>
            失误率 %
            <input name="mistakeRate" type="number" min="1" max="60" step="0.1" defaultValue={Math.round(latest.mistakeRate * 1000) / 10} />
          </label>
          <label>
            深区落点 %
            <input name="deepRate" type="number" min="1" max="95" step="0.1" defaultValue={Math.round(latest.deepRate * 1000) / 10} />
          </label>
          <label>
            平均球速
            <input name="avgSpeed" type="number" min="30" max="180" step="1" defaultValue={Math.round(latest.avgSpeed)} />
          </label>
          <label>
            最高心率
            <input name="maxHr" type="number" min="80" max="210" step="1" defaultValue={latest.maxHr} />
          </label>
          <button type="submit">生成可视化</button>
        </form>
      </Card>
      <Card>
        <div className="card-title">
          <span>后续数据接口</span>
          <span>Ready</span>
        </div>
        <p className="muted">当前版本用表单模拟用户输入。后续可将同一数据模型接入 Tauri 文件读取、手机端传感器、CSV 导入或云端账号同步。</p>
      </Card>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <article className={`card ${className}`}>{children}</article>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Sparkline({ metrics }: { metrics: SessionMetric[] }) {
  const max = Math.max(...metrics.map((metric) => metric.mistakeRate));
  const min = Math.min(...metrics.map((metric) => metric.mistakeRate));
  const points = metrics.map((metric, index) => {
    const x = 8 + (index / Math.max(metrics.length - 1, 1)) * 184;
    const y = 82 - ((max - metric.mistakeRate) / Math.max(max - min, 0.01)) * 64;
    return `${x},${y}`;
  });
  return (
    <svg className="sparkline" viewBox="0 0 200 100">
      <path d="M8 84H192 M8 20H192" className="grid-line" />
      <polyline points={points.join(" ")} className="trend-line" />
    </svg>
  );
}

function RadarChart({ metric }: { metric: SessionMetric }) {
  const values = [
    metric.consistency,
    metric.deepRate,
    Math.min(metric.avgSpeed / 95, 1),
    Math.min(metric.avgSpin / 3200, 1),
    metric.confidence,
  ];
  const labels = ["稳定", "深区", "速度", "旋转", "信心"];
  const center = 80;
  const radius = 62;
  const points = values.map((value, index) => {
    const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2;
    return `${center + Math.cos(angle) * radius * value},${center + Math.sin(angle) * radius * value}`;
  });
  return (
    <svg className="radar" viewBox="0 0 160 160">
      {[0.33, 0.66, 1].map((scale) => (
        <polygon key={scale} points={values.map((_, index) => {
          const angle = -Math.PI / 2 + (index / values.length) * Math.PI * 2;
          return `${center + Math.cos(angle) * radius * scale},${center + Math.sin(angle) * radius * scale}`;
        }).join(" ")} className="radar-grid" />
      ))}
      <polygon points={points.join(" ")} className="radar-shape" />
      {labels.map((label, index) => {
        const angle = -Math.PI / 2 + (index / labels.length) * Math.PI * 2;
        return <text key={label} x={center + Math.cos(angle) * 76} y={center + Math.sin(angle) * 76 + 4} textAnchor="middle">{label}</text>;
      })}
    </svg>
  );
}

function ActionList({ metric }: { metric: SessionMetric }) {
  const weakStroke = metric.strokeStats.reduce((weak, item) => (item.rate > weak.rate ? item : weak), metric.strokeStats[0]);
  return (
    <div className="actions">
      <p><strong>保持：</strong>当前深区控制为 {pct(metric.deepRate)}，继续把高质量回球作为信心来源。</p>
      <p><strong>推进：</strong>{weakStroke.stroke} 失误率 {pct(weakStroke.rate)}，下一课用 15 分钟做稳定线路。</p>
      <p><strong>目标：</strong>把下一次失误率压到 {pct(Math.max(metric.mistakeRate - 0.015, 0.08))}。</p>
    </div>
  );
}

function Bar({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bar-row">
      <div>
        <strong>{label}</strong>
        <span>{sub}</span>
      </div>
      <div className="bar-track">
        <i style={{ width: `${Math.max(4, Math.min(100, value * 100))}%` }} />
      </div>
    </div>
  );
}

function TrajectoryStack({ trajectories }: { trajectories: SessionMetric["trajectories"] }) {
  return (
    <div className="trajectory-stack">
      {trajectories.map((trajectory, index) => {
        const point = trajectory.points[1] || trajectory.points[0];
        return (
          <span
            key={`${point.x}-${point.y}-${index}`}
            style={{
              left: `${12 + ((point.x + 5.5) / 11) * 72}%`,
              bottom: `${14 + point.height_m * 22}%`,
              transform: `translateZ(0) rotate(${index % 2 ? -18 : 18}deg)`,
            }}
            className={trajectory.stroke === "正手" ? "forehand" : ""}
          />
        );
      })}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

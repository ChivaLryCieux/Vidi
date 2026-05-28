import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { Activity, ArrowDownUp, CircleUserRound, Dumbbell, Grid2X2, LineChart, Plus, Radar, Sparkles, Target, Trophy } from "lucide-react";
import "./styles.css";

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

type BadgeData = {
  curveType: "2d" | "3d";
  hilbertPoints: [number, number][];
  gosperPoints: [number, number][];
  zorderPoints: [number, number, number][];
  colorStart: string;
  colorEnd: string;
  colorInverted: string;
  invertedPos: number;
  strokeWidth: number;
  opacity: number;
  variation: number;
};

type StoredBadge = BadgeData & { id: string; timestamp: number };

const badgeStorageKey = "vidi.badges";

function pct(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function cnDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value));
}

const navItems = [
  { id: "overview", label: "总览", icon: Grid2X2 },
  { id: "mint", label: "铸造", icon: Sparkles },
  { id: "mine", label: "我的", icon: CircleUserRound },
] as const;

type ViewId = (typeof navItems)[number]["id"];

const overviewSubTabs = [
  { id: "overview", label: "总览", icon: Grid2X2 },
  { id: "growth", label: "成长", icon: LineChart },
  { id: "court", label: "球场", icon: Target },
  { id: "load", label: "负荷", icon: Activity },
] as const;

type OverviewSubView = (typeof overviewSubTabs)[number]["id"];

function App() {
  const [view, setView] = React.useState<ViewId>("overview");
  const [subView, setSubView] = React.useState<OverviewSubView>("overview");
  const [baseMetrics, setBaseMetrics] = React.useState<SessionMetric[]>([]);
  const [selected, setSelected] = React.useState(0);
  const metrics = baseMetrics;
  const current = metrics[selected] || metrics[metrics.length - 1];
  const first = metrics[0];
  const latest = metrics[metrics.length - 1];

  React.useEffect(() => {
    invoke<SessionMetric[]>("get_sessions").then((sessions) => {
      setBaseMetrics(sessions);
      setSelected(sessions.length - 1);
    });
  }, []);

  const improvement = first && latest ? (first.mistakeRate - latest.mistakeRate) / first.mistakeRate : 0;

  if (!first) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <div>
            <p className="kicker">Vidi Tennis Intelligence</p>
            <h1>Vidi</h1>
          </div>
          <div className="mark" aria-label="Vidi mark">V</div>
        </header>
        <p className="muted" style={{ marginTop: 24, textAlign: "center" }}>加载训练数据中...</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className={`topbar${view !== "overview" ? " topbar--full" : ""}`}>
        <div>
          <p className="kicker">Vidi Tennis Intelligence</p>
          <h1>Vidi</h1>
        </div>
        <div className="mark" aria-label="Vidi mark">V</div>
      </header>

      {view === "overview" && (
        <>
          <section className="hero-strip">
            <div>
              <span>半年度成长叙事</span>
              <strong>{pct(improvement)} 失误率改善</strong>
            </div>
            <Sparkles size={28} />
          </section>
          <SessionRail metrics={metrics} selected={selected} onSelect={setSelected} />
        </>
      )}

      <section className="view-frame">
        {view === "overview" && (
          <>
            <div className="sub-tabs" aria-label="总览子导航">
              {overviewSubTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} className={subView === tab.id ? "active" : ""} onClick={() => setSubView(tab.id)} type="button">
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            {subView === "overview" && <Overview current={current} first={first} latest={latest} metrics={metrics} />}
            {subView === "growth" && <Growth metrics={metrics} selected={selected} onSelect={setSelected} />}
            {subView === "court" && <CourtView current={current} />}
            {subView === "load" && <LoadView current={current} metrics={metrics} />}
          </>
        )}
        {view === "mint" && <MintView latest={latest} />}
        {view === "mine" && <MineView />}
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
        <div className="court-wrap">
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
        <div className="load-grid" aria-label="训练负荷矩阵">
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

function MintView({ latest }: { latest?: SessionMetric }) {
  const [badge, setBadge] = React.useState<StoredBadge | null>(null);
  const [generating, setGenerating] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setGenerating(true);
    try {
      const data = await invoke<BadgeData>("gen_badge", {
        timestamp: new Date(String(form.get("timestamp"))).getTime(),
        durationMin: Number(form.get("durationMin")),
        totalShots: Number(form.get("totalShots")),
        avgSpeed: Number(form.get("avgSpeed")),
        avgApex: Number(form.get("avgApex")),
        peakHr: Number(form.get("peakHr")),
      });
      const stored: StoredBadge = { ...data, id: `${Date.now()}`, timestamp: Date.now() };
      setBadge(stored);
      // Persist to localStorage
      try {
        const existing = JSON.parse(localStorage.getItem(badgeStorageKey) || "[]") as StoredBadge[];
        localStorage.setItem(badgeStorageKey, JSON.stringify([stored, ...existing].slice(0, 80)));
      } catch { /* ignore */ }
    } finally {
      setGenerating(false);
    }
  }

  const defaults = latest ? {
    timestamp: new Date(latest.date).toISOString().slice(0, 16),
    durationMin: 60,
    totalShots: latest.shots,
    avgSpeed: Math.round(latest.avgSpeed),
    avgApex: 1.8,
    peakHr: latest.maxHr,
  } : { timestamp: "", durationMin: 60, totalShots: 1200, avgSpeed: 65, avgApex: 1.8, peakHr: 155 };

  return (
    <div className="grid-view">
      <Card className="wide-card">
        <div className="card-title">
          <span>训练数据录入</span>
          <Plus size={20} />
        </div>
        <form className="data-form" onSubmit={handleSubmit}>
          <label>
            训练时间
            <input name="timestamp" type="datetime-local" defaultValue={defaults.timestamp} required />
          </label>
          <label>
            训练时长 (分钟)
            <input name="durationMin" type="number" min="1" step="1" defaultValue={defaults.durationMin} required />
          </label>
          <label>
            总拍数
            <input name="totalShots" type="number" min="1" step="1" defaultValue={defaults.totalShots} required />
          </label>
          <label>
            回球速度均值 (km/h)
            <input name="avgSpeed" type="number" min="1" step="0.1" defaultValue={defaults.avgSpeed} required />
          </label>
          <label>
            轨迹顶点高度均值 (m)
            <input name="avgApex" type="number" min="0.1" max="5" step="0.01" defaultValue={defaults.avgApex} required />
          </label>
          <label>
            心率峰值 (bpm)
            <input name="peakHr" type="number" min="60" max="220" step="1" defaultValue={defaults.peakHr} required />
          </label>
          <button type="submit" disabled={generating}>{generating ? "生成中..." : "铸造徽章"}</button>
        </form>
      </Card>
      {badge && (
        <Card className="badge-studio wide-card">
          <div className="card-title">
            <span>铸造结果</span>
            <Sparkles size={20} />
          </div>
          <div className="badge-studio-body">
            <div className="badge-preview">
              <BadgeMark badge={badge} />
            </div>
            <div className="badge-actions">
              <strong>{badge.curveType === "2d" ? "Hilbert + Gosper" : "Z-Order 3D"}</strong>
              <p className="muted">
                线宽 {badge.strokeWidth.toFixed(1)} / 不透明度 {badge.opacity.toFixed(2)} / 变点 {badge.variation.toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function MineView() {
  const [badges] = React.useState<StoredBadge[]>(readBadges);

  return (
    <div className="grid-view">
      <Card className="wide-card">
        <div className="card-title">
          <span>我的徽章</span>
          <span>{badges.length} 枚</span>
        </div>
        {badges.length ? (
          <div className="badge-grid" aria-label="本地生成徽章">
            {badges.map((badge) => (
              <figure key={badge.id} className="badge-tile">
                <BadgeMark badge={badge} />
                <figcaption>
                  <strong>{new Date(badge.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong>
                  <span>{new Date(badge.timestamp).toLocaleDateString("zh-CN")}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="muted">还没有徽章，去铸造一枚吧。</p>
        )}
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

function BadgeMark({ badge }: { badge: StoredBadge }) {
  const size = 200;
  const pad = 10;
  const uid = badge.id;

  function ptsToPath(points: [number, number][]): string {
    if (!points.length) return "";
    return points.map((p, i) => {
      const x = p[0] * (size - pad * 2) + pad;
      const y = p[1] * (size - pad * 2) + pad;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }

  // Inverted color accent segment around invertedPos
  function accentPath(points: [number, number][], pos: number, width: number): string {
    if (points.length < 10) return "";
    const idx = Math.floor(pos * (points.length - 1));
    const half = Math.max(3, Math.floor(width * points.length / 2));
    const slice = points.slice(Math.max(0, idx - half), Math.min(points.length, idx + half));
    return ptsToPath(slice);
  }

  const mainPath = badge.curveType === "2d"
    ? ptsToPath(badge.hilbertPoints)
    : "";

  const secondPath = badge.curveType === "2d"
    ? ptsToPath(badge.gosperPoints)
    : "";

  // 3D: project z-order points to 2D with perspective
  function zorderPath(points: [number, number, number][], offset: number): string {
    if (!points.length) return "";
    return points.map((p, i) => {
      const scale = 1.0 / (1.0 + p[2] * 0.3 + offset * 0.15);
      const x = (p[0] * scale + offset * 0.04) * (size - pad * 2) + pad;
      const y = (p[1] * scale + offset * 0.04) * (size - pad * 2) + pad;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }

  const layers = badge.curveType === "3d" ? Math.max(1, Math.round(badge.variation)) : 0;

  return (
    <svg className="badge-mark" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="训练数据徽章">
      <defs>
        <clipPath id={`bc-${uid}`}>
          <circle cx={size / 2} cy={size / 2} r={size / 2 - 6} />
        </clipPath>
        <linearGradient id={`bg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={badge.colorStart} />
          <stop offset="100%" stopColor={badge.colorEnd} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 4} className="badge-ring" />
      <g clipPath={`url(#bc-${uid})`}>
        {badge.curveType === "2d" ? (
          <>
            <path d={mainPath} fill="none" stroke={`url(#bg-${uid})`} strokeWidth={badge.strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={badge.opacity} />
            <path d={secondPath} fill="none" stroke={`url(#bg-${uid})`} strokeWidth={badge.strokeWidth * 0.7} strokeLinecap="round" strokeLinejoin="round" opacity={badge.opacity * 0.85} />
            {badge.hilbertPoints.length > 5 && (
              <path d={accentPath(badge.hilbertPoints, badge.invertedPos, 0.06)} fill="none" stroke={badge.colorInverted} strokeWidth={badge.strokeWidth * 1.5} strokeLinecap="round" opacity={0.9} />
            )}
          </>
        ) : (
          <>
            {Array.from({ length: layers }, (_, i) => (
              <path key={i} d={zorderPath(badge.zorderPoints, i)} fill="none" stroke={`url(#bg-${uid})`} strokeWidth={badge.strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={badge.opacity * (0.5 + 0.5 * (i + 1) / layers)} />
            ))}
            {badge.zorderPoints.length > 5 && (
              <path d={accentPath(badge.zorderPoints.map(p => [p[0], p[1]] as [number, number]), badge.invertedPos, 0.06)} fill="none" stroke={badge.colorInverted} strokeWidth={badge.strokeWidth * 1.5} strokeLinecap="round" opacity={0.9} />
            )}
          </>
        )}
      </g>
    </svg>
  );
}

function readBadges(): StoredBadge[] {
  try {
    const stored = JSON.parse(localStorage.getItem(badgeStorageKey) || "[]") as unknown;
    if (!Array.isArray(stored)) {
      return [];
    }
    return stored.filter(isStoredBadge).slice(0, 80);
  } catch {
    return [];
  }
}

function isStoredBadge(value: unknown): value is StoredBadge {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as StoredBadge).id === "string" &&
    typeof (value as StoredBadge).timestamp === "number" &&
    typeof (value as StoredBadge).curveType === "string",
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

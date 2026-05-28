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

type TimestampBadge = {
  id: string;
  timestamp: number;
};

const badgeStorageKey = "vidi.timestamp-badges";

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
  const [manualSessions, setManualSessions] = React.useState<SessionMetric[]>([]);
  const metrics = [...baseMetrics, ...manualSessions];
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

  async function addManualSession(form: FormData) {
    const synthetic = await invoke<SessionMetric>("add_manual_session", {
      theme: String(form.get("theme") || "自主训练"),
      mistakeRate: Number(form.get("mistakeRate")) / 100,
      deepRate: Number(form.get("deepRate")) / 100,
      avgSpeed: Number(form.get("avgSpeed")),
      maxHr: Number(form.get("maxHr")),
    });
    setManualSessions((items) => [...items, synthetic]);
    setSelected(metrics.length);
    setView("overview");
  }

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
      <header className="topbar">
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
        {view === "mint" && <MintView onAdd={addManualSession} latest={latest} />}
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

function MintView({ onAdd, latest }: { onAdd: (form: FormData) => void; latest: SessionMetric }) {
  const [badges, setBadges] = React.useState<TimestampBadge[]>(readBadges);

  React.useEffect(() => {
    try {
      localStorage.setItem(badgeStorageKey, JSON.stringify(badges));
    } catch {
      // Local persistence can be disabled by the host webview.
    }
  }, [badges]);

  function addBadge() {
    const timestamp = Date.now();
    setBadges((items) => [{ id: `${timestamp}-${items.length}`, timestamp }, ...items].slice(0, 80));
  }

  const latestBadge = badges[0];

  return (
    <div className="grid-view">
      <InputView onAdd={onAdd} latest={latest} />
      <Card className="badge-studio wide-card">
        <div className="card-title">
          <span>时间戳徽章铸造</span>
          <Sparkles size={20} />
        </div>
        <div className="badge-studio-body">
          <div className="badge-preview">
            {latestBadge ? <BadgeMark badge={latestBadge} /> : <span className="badge-placeholder" aria-hidden="true" />}
          </div>
          <div className="badge-actions">
            <strong>{latestBadge ? `#${latestBadge.timestamp}` : "新徽章"}</strong>
            <p className="muted">{latestBadge ? formatMoment(latestBadge.timestamp) : "等待时间签名"}</p>
            <button type="button" onClick={addBadge}>
              <Plus size={20} />
              <span>铸造徽章</span>
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MineView() {
  const [badges] = React.useState<TimestampBadge[]>(readBadges);

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

function BadgeMark({ badge }: { badge: TimestampBadge }) {
  const pattern = createBadgePattern(badge.timestamp);

  return (
    <svg className="badge-mark" viewBox="0 0 120 120" role="img" aria-label={`时间戳 ${badge.timestamp} 生成的徽章`}>
      <defs>
        <clipPath id={`badge-clip-${badge.id}`}>
          <circle cx="60" cy="60" r="54" />
        </clipPath>
        <linearGradient id={`badge-bg-${badge.id}`} x1={`${pattern.angle}%`} y1="4%" x2={`${100 - pattern.angle}%`} y2="100%">
          <stop offset="0%" stopColor={pattern.mint} />
          <stop offset="48%" stopColor={pattern.green} />
          <stop offset="100%" stopColor={pattern.deep} />
        </linearGradient>
        <radialGradient id={`badge-glow-${badge.id}`} cx={`${pattern.glow.x}%`} cy={`${pattern.glow.y}%`} r="68%">
          <stop offset="0%" stopColor={pattern.glow.color} stopOpacity="0.92" />
          <stop offset="56%" stopColor={pattern.glow.color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={pattern.glow.color} stopOpacity="0" />
        </radialGradient>
        <filter id={`badge-soft-${badge.id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <circle cx="60" cy="60" r="56" className="badge-ring" />
      <g clipPath={`url(#badge-clip-${badge.id})`}>
        <rect width="120" height="120" fill={`url(#badge-bg-${badge.id})`} />
        <rect width="120" height="120" fill={`url(#badge-glow-${badge.id})`} />
        {pattern.blooms.map((bloom, index) => (
          <ellipse
            key={`${bloom.x}-${bloom.y}-${index}`}
            cx={bloom.x}
            cy={bloom.y}
            rx={bloom.rx}
            ry={bloom.ry}
            fill={bloom.color}
            opacity={bloom.opacity}
            filter={`url(#badge-soft-${badge.id})`}
            transform={`rotate(${bloom.rotate} ${bloom.x} ${bloom.y})`}
          />
        ))}
        {pattern.streams.map((stream, index) => (
          <g key={`${stream.path}-${index}`} opacity={stream.opacity}>
            <path d={stream.path} className="badge-river" style={{ strokeWidth: stream.width }} />
            <path d={stream.highlight} className="badge-river-highlight" style={{ strokeWidth: stream.highlightWidth }} />
          </g>
        ))}
        {pattern.glints.map((glint, index) => (
          <circle
            key={`${glint.x}-${glint.y}-${index}`}
            cx={glint.x}
            cy={glint.y}
            r={glint.radius}
            className="badge-glint"
            opacity={glint.opacity}
          />
        ))}
        <path d={pattern.sheen} className="badge-sheen" />
      </g>
    </svg>
  );
}

function readBadges(): TimestampBadge[] {
  try {
    const stored = JSON.parse(localStorage.getItem(badgeStorageKey) || "[]") as unknown;
    if (!Array.isArray(stored)) {
      return [];
    }

    return stored.filter(isTimestampBadge).slice(0, 80);
  } catch {
    return [];
  }
}

function isTimestampBadge(value: unknown): value is TimestampBadge {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as TimestampBadge).id === "string" &&
    typeof (value as TimestampBadge).timestamp === "number",
  );
}

function createBadgePattern(timestamp: number) {
  let state = mixSeed(timestamp);
  const next = () => {
    state = Math.imul(state ^ (state >>> 15), 2246822519);
    state = Math.imul(state ^ (state >>> 13), 3266489917);
    return ((state ^= state >>> 16) >>> 0) / 4294967296;
  };
  const hue = Math.floor(112 + next() * 34);
  const streamCount = 2 + Math.floor(next() * 3);

  return {
    angle: 14 + next() * 26,
    mint: `hsl(${hue - 18} 74% 91%)`,
    green: `hsl(${hue} 66% 62%)`,
    deep: `hsl(${hue + 8} 68% 32%)`,
    glow: {
      x: 24 + next() * 34,
      y: 18 + next() * 34,
      color: `hsl(${hue - 30} 88% 92%)`,
    },
    blooms: [
      createBadgeBloom(next, hue - 12, 0.4),
      createBadgeBloom(next, hue + 8, 0.34),
      createBadgeBloom(next, hue - 26, 0.26),
    ],
    streams: Array.from({ length: streamCount }, (_, index) => createBadgeStream(next, index)),
    glints: Array.from({ length: 2 + Math.floor(next() * 4) }, () => createBadgeGlint(next)),
    sheen: createBadgeSheen(next),
  };
}

function createBadgeBloom(next: () => number, hue: number, opacity: number) {
  return {
    x: 14 + next() * 92,
    y: 16 + next() * 88,
    rx: 18 + next() * 30,
    ry: 14 + next() * 24,
    rotate: -46 + next() * 92,
    color: `hsl(${hue} ${62 + next() * 20}% ${64 + next() * 18}%)`,
    opacity,
  };
}

function createBadgeStream(next: () => number, index: number) {
  const startSide = next() > 0.5;
  const startX = startSide ? -18 : 138;
  const endX = startSide ? 138 : -18;
  const startY = 10 + next() * 100;
  const endY = 10 + next() * 100;
  const bendA = startSide ? 16 + next() * 38 : 104 - next() * 38;
  const bendB = startSide ? 76 + next() * 42 : 44 - next() * 42;
  const driftA = clampPoint(startY + (next() - 0.5) * (68 + index * 8));
  const driftB = clampPoint(endY + (next() - 0.5) * (76 + index * 10));
  const path = `M${startX} ${startY}C${bendA} ${driftA} ${bendB} ${driftB} ${endX} ${endY}`;
  const offset = -10 + next() * 20;
  const highlight = `M${startX} ${clampPoint(startY + offset)}C${bendA + (next() - 0.5) * 12} ${clampPoint(driftA + offset * 0.7)} ${bendB + (next() - 0.5) * 12} ${clampPoint(driftB - offset * 0.5)} ${endX} ${clampPoint(endY - offset * 0.35)}`;

  return {
    path,
    highlight,
    width: 14 + next() * (index ? 18 : 30),
    highlightWidth: 3 + next() * 7,
    opacity: 0.24 + next() * 0.34,
  };
}

function createBadgeGlint(next: () => number) {
  return {
    x: 20 + next() * 80,
    y: 18 + next() * 84,
    radius: 1.4 + next() * 4.8,
    opacity: 0.18 + next() * 0.42,
  };
}

function createBadgeSheen(next: () => number) {
  const start = 12 + next() * 18;
  const end = 82 + next() * 24;
  const lift = 6 + next() * 18;
  return `M${start} ${24 + next() * 16}C${30 + next() * 16} ${lift} ${62 + next() * 18} ${lift - 2 + next() * 12} ${end} ${22 + next() * 18}`;
}

function clampPoint(value: number) {
  return Math.max(-12, Math.min(132, value));
}

function mixSeed(timestamp: number) {
  return Math.imul(timestamp ^ (timestamp >>> 16), 2654435761) >>> 0;
}

function formatMoment(timestamp: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(timestamp));
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

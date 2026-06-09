import React from "react";
import { createPortal } from "react-dom";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { Activity, ArrowDownUp, CircleUserRound, Download, Dumbbell, Grid2X2, LineChart, Plus, Radar, Share2, Sparkles, Target, Trophy, X } from "lucide-react";
import "./styles.css";

// ── Scroll-reveal hook: staggers card entrance as they scroll into view ──
function useScrollReveal() {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const cards = container.querySelectorAll(".card");
    if (!cards.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );
    // Stagger delay for each card
    cards.forEach((card, i) => {
      (card as HTMLElement).style.transitionDelay = `${i * 70}ms`;
      observer.observe(card);
    });
    return () => observer.disconnect();
  });
  return ref;
}

function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? createPortal(children, document.body) : null;
}

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
  trajectories: { points: { x: number; y: number; heightM: number }[]; stroke: string }[];
};

type BadgeData = {
  curveType: "2d" | "3d" | "rings" | "ringsBlack" | "parametric3d";
  mergedPoints: [number, number][];
  zorderPoints: [number, number, number][];
  ringPanels?: {
    points: [[number, number], [number, number], [number, number], [number, number]];
    color: string;
    opacity: number;
    front: boolean;
  }[];
  colorStart: string;
  colorEnd: string;
  colorInverted: string;
  invertedPos: number;
  strokeWidth: number;
  opacity: number;
  variation: number;
};

type StoredBadge = BadgeData & {
  id: string;
  timestamp: number;
  durationMin?: number;
  totalShots?: number;
  avgSpeed?: number;
  avgApex?: number;
  peakHr?: number;
  sessionId?: string;
  visualTone?: string;
  visualElement?: string;
  communityImageName?: string;
  communityName?: string;
  communityCreator?: string;
  communityComment?: string;
};

const badgeStorageKey = "vidi.badges";
const featuredBadgeStorageKey = "vidi.featuredBadges";
const badgeStorageSoftLimit = 100;
const badgeStorageMinimum = 20;
type MintMode = "normal" | "hidden" | "hiddenBlack";

function pct(value: number) {
  return `${Math.round(value * 1000) / 10}%`;
}

function cnDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(new Date(value));
}

const navItems = [
  { id: "mine", label: "我的", icon: CircleUserRound },
  { id: "mint", label: "铸造", icon: Sparkles },
  { id: "overview", label: "总览", icon: Grid2X2 },
] as const;

type ViewId = (typeof navItems)[number]["id"];
type CollectionFilter = "all" | "warm" | "cool" | "mono" | "standard" | "iridescent" | "obsidian";
type MintStep = "session" | "data" | "visual" | "preview";
type VisualTone = "classic" | "clay" | "electric";
type VisualElement = "court" | "racket" | "ball" | "numbers";

const collectionFilters: { id: CollectionFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "warm", label: "暖色" },
  { id: "cool", label: "冷色" },
  { id: "mono", label: "黑白" },
  { id: "standard", label: "标准" },
  { id: "iridescent", label: "炫彩" },
  { id: "obsidian", label: "黑曜" },
];

const mintSteps: { id: MintStep; label: string }[] = [
  { id: "session", label: "训练" },
  { id: "data", label: "数据" },
  { id: "visual", label: "元素" },
  { id: "preview", label: "预览" },
];

const visualTones: { id: VisualTone; label: string; desc: string }[] = [
  { id: "classic", label: "网球绿", desc: "稳定、清晰、经典" },
  { id: "clay", label: "红土", desc: "力量、摩擦、爆发感" },
  { id: "electric", label: "电光", desc: "速度、反应、竞技性" },
];

const visualElements: { id: VisualElement; label: string; desc: string }[] = [
  { id: "court", label: "球场线", desc: "把落点和空间秩序叠进徽章" },
  { id: "racket", label: "球拍弧", desc: "强调挥拍路径与节奏" },
  { id: "ball", label: "网球粒子", desc: "表现旋转、击球和轨迹" },
  { id: "numbers", label: "数字刻度", desc: "保留训练数据的可读痕迹" },
];

const overviewSubTabs = [
  { id: "overview", label: "总览", icon: Grid2X2 },
  { id: "growth", label: "成长", icon: LineChart },
  { id: "court", label: "球场", icon: Target },
  { id: "load", label: "负荷", icon: Activity },
] as const;

type OverviewSubView = (typeof overviewSubTabs)[number]["id"];

function App() {
  const [view, setView] = React.useState<ViewId>("mine");
  const [subView, setSubView] = React.useState<OverviewSubView>("overview");
  const [baseMetrics, setBaseMetrics] = React.useState<SessionMetric[]>([]);
  const [selected, setSelected] = React.useState(0);
  const [badges, setBadges] = React.useState<StoredBadge[]>([]);
  const metrics = baseMetrics;
  const current = metrics[selected] || metrics[metrics.length - 1];
  const first = metrics[0];
  const latest = metrics[metrics.length - 1];

  React.useEffect(() => {
    // Clear history once on load of this version to satisfy history cleanup
    const versionClearedKey = "vidi.cleared_v2";
    if (!localStorage.getItem(versionClearedKey)) {
      localStorage.removeItem(badgeStorageKey);
      localStorage.setItem(versionClearedKey, "true");
    }

    setBadges(readBadges());

    invoke<SessionMetric[]>("get_sessions")
      .then((sessions) => {
        setBaseMetrics(sessions);
        setSelected(sessions.length - 1);
      })
      .catch((err) => {
        console.error("get_sessions failed:", err);
      });
  }, []);

  const improvement = first && current ? (first.mistakeRate - current.mistakeRate) / first.mistakeRate : 0;
  const visibleMetrics = metrics.slice(0, selected + 1);

  const [showAddDataModal, setShowAddDataModal] = React.useState(false);

  const shotsList = metrics.map((m) => m.shots);
  const minShots = shotsList.length ? Math.round(Math.min(...shotsList) * 0.7) : 400;
  const maxShots = shotsList.length ? Math.round(Math.max(...shotsList) * 1.3) : 2500;

  const speedList = metrics.map((m) => m.avgSpeed);
  const minSpeed = speedList.length ? Math.round(Math.min(...speedList) * 0.7) : 40;
  const maxSpeed = speedList.length ? Math.round(Math.max(...speedList) * 1.3) : 150;

  const hrList = metrics.map((m) => m.maxHr);
  const minHr = hrList.length ? Math.round(Math.min(...hrList) * 0.8) : 100;
  const maxHrVal = hrList.length ? Math.min(220, Math.round(Math.max(...hrList) * 1.2)) : 210;

  async function handleAddDataSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dateInput = form.get("date") as string;
    const themeInput = form.get("theme") as string;
    const shotsInput = Number(form.get("shots"));
    const mistakesInput = Number(form.get("mistakes"));
    const deepRateInput = Number(form.get("deepRate"));
    const avgSpeedInput = Number(form.get("avgSpeed"));
    const maxHrInput = Number(form.get("maxHr"));

    if (mistakesInput > shotsInput) {
      alert("失误数不能大于总击球数！");
      return;
    }

    const mistakeRateInput = mistakesInput / shotsInput;

    try {
      const newSession = await invoke<SessionMetric>("add_manual_session", {
        theme: themeInput,
        mistakeRate: mistakeRateInput,
        deepRate: deepRateInput,
        avgSpeed: avgSpeedInput,
        maxHr: maxHrInput,
      });

      newSession.date = new Date(dateInput).toISOString().slice(0, 10);
      newSession.shots = shotsInput;
      newSession.playerShots = Math.round(shotsInput * 0.5);
      newSession.mistakes = mistakesInput;
      newSession.mistakeRate = mistakeRateInput;
      newSession.deepRate = deepRateInput;
      newSession.avgSpeed = avgSpeedInput;
      newSession.maxHr = maxHrInput;
      newSession.avgHr = Math.round(maxHrInput - 18);
      newSession.consistency = 1.0 - mistakeRateInput;
      newSession.confidence = Math.min(0.96, 0.48 + newSession.consistency * 0.32 + deepRateInput * 0.18);

      const tempMetrics = [...baseMetrics, newSession].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const newIndex = tempMetrics.findIndex((m) => m.id === newSession.id);
      
      let status = "巩固期";
      if (newIndex > 0) {
        const prev = tempMetrics[newIndex - 1];
        if (newSession.mistakeRate < prev.mistakeRate) {
          status = "突破期";
        }
      }
      newSession.status = status;

      const updatedList = tempMetrics.map((m, idx) => ({
        ...m,
        index: idx,
        label: `S${idx + 1}`
      }));

      setBaseMetrics(updatedList);
      setShowAddDataModal(false);

      const finalIdx = updatedList.findIndex((m) => m.id === newSession.id);
      setSelected(finalIdx);
    } catch (err) {
      alert(`录入失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!metrics.length) {
    return (
      <main className="app-shell">
        <header className="page-header">
          <h1>数据载入中...</h1>
        </header>
        <section className="view-frame">
          <p className="muted" style={{ marginTop: 24, textAlign: "center" }}>加载训练数据中...</p>
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

  return (
    <main className={`app-shell${view !== "overview" ? " app-shell--full" : ""}`}>
      {view === "overview" && (
        <>
          <header className="page-header">
            <h1>你的进步：  {pct(improvement)}</h1>
          </header>
          <SessionRail
            metrics={metrics}
            selected={selected}
            onSelect={setSelected}
            onAddDataClick={() => setShowAddDataModal(true)}
          />
        </>
      )}
      {view === "mint" && (
        <header className="page-header">
          <h1>铸造你的徽章</h1>
        </header>
      )}
      {view === "mine" && (
        <header className="page-header">
          <h1>你已收集 {badges.length} 枚徽章</h1>
        </header>
      )}

      <section className="view-frame" key={`${view}-${subView}`}>
        {view === "overview" && (
          <>
            <div className="sub-tabs" aria-label="总览子导航">
              {overviewSubTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} className={subView === tab.id ? "active" : ""} onClick={() => setSubView(tab.id)} type="button">
                    <Icon size={15} strokeWidth={1.8} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            {subView === "overview" && <Overview current={current} first={first} latest={current} metrics={visibleMetrics} />}
            {subView === "growth" && <Growth metrics={visibleMetrics} selected={selected} onSelect={setSelected} />}
            {subView === "court" && <CourtView current={current} />}
            {subView === "load" && <LoadView current={current} metrics={visibleMetrics} />}
          </>
        )}
        {view === "mint" && (
          <MintView
            metrics={metrics}
            onBadgeMinted={() => {
              setBadges(readBadges());
              setView("mine");
            }}
          />
        )}
        {view === "mine" && (
          <MineView
            badges={badges}
            setBadges={setBadges}
            setView={setView}
            setSubView={setSubView}
            setSelected={setSelected}
            metrics={metrics}
          />
        )}
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

      {showAddDataModal && (
        <ModalPortal>
        <div className="badge-modal-overlay" onClick={() => setShowAddDataModal(false)}>
          <div className="badge-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "85vh", overflowY: "auto" }}>
            <button className="badge-modal-close" onClick={() => setShowAddDataModal(false)} type="button">
              <X size={16} />
            </button>
            <div className="badge-modal-title" style={{ marginBottom: 16 }}>
              <h3>录入新训练数据</h3>
              <span>系统将根据现有历史自动分析该场表现</span>
            </div>
            
            <form className="data-form" onSubmit={handleAddDataSubmit}>
              <label>
                训练日期
                <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
              </label>
              
              <label>
                训练主题
                <input name="theme" type="text" placeholder="例如：正手稳定性专项" defaultValue="主攻正手训练" required />
              </label>

              <label>
                总击球数 (范围: {minShots} - {maxShots})
                <input name="shots" type="number" min={minShots} max={maxShots} defaultValue={1200} required />
              </label>

              <label>
                失误球数 (范围: 0 - {Math.round(maxShots * 0.4)})
                <input name="mistakes" type="number" min={0} max={Math.round(maxShots * 0.4)} defaultValue={120} required />
              </label>

              <label>
                落点深区率 (范围: 0.1 - 0.9)
                <input name="deepRate" type="number" min={0.1} max={0.9} step={0.01} defaultValue={0.4} required />
              </label>

              <label>
                击球均速 (km/h, 范围: {minSpeed} - {maxSpeed})
                <input name="avgSpeed" type="number" min={minSpeed} max={maxSpeed} defaultValue={70} required />
              </label>

              <label>
                峰值心率 (bpm, 范围: {minHr} - {maxHrVal})
                <input name="maxHr" type="number" min={minHr} max={maxHrVal} defaultValue={160} required />
              </label>

              <button
                className="button primary"
                type="submit"
                style={{
                  width: "100%",
                  minHeight: 46,
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: "bold",
                  background: "var(--ink)",
                  color: "#ffffff",
                  border: "none",
                  marginTop: 16,
                  cursor: "pointer"
                }}
              >
                开始分析并录入
              </button>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </main>
  );
}

function SessionRail({
  metrics,
  selected,
  onSelect,
  onAddDataClick,
}: {
  metrics: SessionMetric[];
  selected: number;
  onSelect: (value: number) => void;
  onAddDataClick: () => void;
}) {
  return (
    <div className="session-rail" aria-label="训练场次">
      {metrics.map((metric, index) => (
        <button key={metric.id} className={index === selected ? "active" : ""} onClick={() => onSelect(index)} type="button">
          <span>{metric.label}</span>
          <small>{cnDate(metric.date)}</small>
        </button>
      ))}
      <button className="add-data-btn" onClick={onAddDataClick} type="button">
        <Plus size={16} />
        <span>录入数据</span>
      </button>
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
          {metrics.length === 1 ? (
            <span>首次训练，稳定性为 {pct(first.consistency)}。</span>
          ) : (
            <span>相对首次训练，最近一次稳定性从 {pct(first.consistency)} 到 {pct(latest.consistency)}。</span>
          )}
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
    const x = metrics.length === 1 ? 160 : 20 + (index / (metrics.length - 1)) * 280;
    const y = metrics.length === 1 ? 115 : 190 - ((1 - metric.mistakeRate - min) / (max - min)) * 150;
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
          <div className="court-line singles-left" />
          <div className="court-line singles-right" />
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

function MintView({
  metrics,
  onBadgeMinted,
}: {
  metrics: SessionMetric[];
  onBadgeMinted: () => void;
}) {
  const [selectedIdx, setSelectedIdx] = React.useState(metrics.length - 1);
  const [candidates, setCandidates] = React.useState<StoredBadge[]>([]);
  const [selectedCandidateIdx, setSelectedCandidateIdx] = React.useState<number>(0);
  const [mintStep, setMintStep] = React.useState<MintStep>("session");
  const [visualTone, setVisualTone] = React.useState<VisualTone>("classic");
  const [visualElement, setVisualElement] = React.useState<VisualElement>("court");
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const currentSession = metrics[selectedIdx] || metrics[metrics.length - 1];

  const defaults = currentSession ? {
    timestamp: new Date(currentSession.date).toISOString().slice(0, 16),
    durationMin: 60,
    totalShots: currentSession.shots,
    avgSpeed: Math.round(currentSession.avgSpeed),
    avgApex: 1.8,
    peakHr: currentSession.maxHr,
  } : { timestamp: "", durationMin: 60, totalShots: 1200, avgSpeed: 65, avgApex: 1.8, peakHr: 155 };
  const [mintForm, setMintForm] = React.useState(defaults);
  const currentStepIndex = mintSteps.findIndex((step) => step.id === mintStep);
  const selectedTone = visualTones.find((tone) => tone.id === visualTone) ?? visualTones[0];
  const selectedElement = visualElements.find((element) => element.id === visualElement) ?? visualElements[0];
  const selectedCandidate = candidates[selectedCandidateIdx];

  React.useEffect(() => {
    setMintForm(defaults);
    setCandidates([]);
    setSelectedCandidateIdx(0);
    setMintStep("session");
    setSaveError(null);
    setError(null);
  }, [selectedIdx]);

  function updateMintForm<K extends keyof typeof mintForm>(key: K, value: (typeof mintForm)[K]) {
    setMintForm((current) => ({ ...current, [key]: value }));
  }

  function goToMintStep(step: MintStep) {
    setMintStep(step);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setSaveError(null);
    try {
      const mintedAt = Date.now();
      const durationMin = Number(mintForm.durationMin);
      const totalShots = Number(mintForm.totalShots);
      const avgSpeed = Number(mintForm.avgSpeed);
      const avgApex = Number(mintForm.avgApex);
      const peakHr = Number(mintForm.peakHr);
      const formTimestamp = mintForm.timestamp;
      const trainingTime = formTimestamp ? new Date(formTimestamp).getTime() : mintedAt;
      const visualParams = { visualTone, visualElement };

      const [normalData, hiddenData, hiddenBlackData] = await Promise.all([
        invoke<BadgeData>("gen_badge", { timestamp: trainingTime, durationMin, totalShots, avgSpeed, avgApex, peakHr, ...visualParams }),
        invoke<BadgeData>("gen_hidden_badge", { timestamp: trainingTime, durationMin, totalShots, avgSpeed, avgApex, peakHr, ...visualParams }),
        invoke<BadgeData>("gen_hidden_black_badge", { timestamp: trainingTime, durationMin, totalShots, avgSpeed, avgApex, peakHr, ...visualParams })
      ]);

      const items: StoredBadge[] = [
        {
          ...normalData,
          id: `${mintedAt}-normal`,
          timestamp: trainingTime,
          durationMin,
          totalShots,
          avgSpeed,
          avgApex,
          peakHr,
          sessionId: currentSession.id,
          visualTone,
          visualElement
        },
        {
          ...hiddenData,
          id: `${mintedAt}-hidden`,
          timestamp: trainingTime,
          durationMin,
          totalShots,
          avgSpeed,
          avgApex,
          peakHr,
          sessionId: currentSession.id,
          visualTone,
          visualElement
        },
        {
          ...hiddenBlackData,
          id: `${mintedAt}-hiddenBlack`,
          timestamp: trainingTime,
          durationMin,
          totalShots,
          avgSpeed,
          avgApex,
          peakHr,
          sessionId: currentSession.id,
          visualTone,
          visualElement
        }
      ];

      setCandidates(items);
      setSelectedCandidateIdx(0);
      setMintStep("preview");
    } catch (err) {
      setError(`铸造失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGenerating(false);
    }
  }

  function handleSaveSelected() {
    const selectedBadge = candidates[selectedCandidateIdx];
    if (!selectedBadge) return;
    try {
      saveBadgeToGallery(selectedBadge);
      onBadgeMinted();
      setCandidates([]);
    } catch (err) {
      setSaveError(`保存失败：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="mint-story">
      <div className="mint-progress" aria-label="铸造步骤">
        {mintSteps.map((step, index) => (
          <button
            key={step.id}
            className={mintStep === step.id ? "active" : index < currentStepIndex ? "done" : ""}
            onClick={() => goToMintStep(step.id)}
            type="button"
          >
            <span>{index + 1}</span>
            <strong>{step.label}</strong>
          </button>
        ))}
      </div>

      <form className="mint-story-card" onSubmit={handleSubmit}>
        {mintStep === "session" && (
          <section className="mint-page">
            <div className="mint-page-copy">
              <span>Step 01</span>
              <h2>选择你的训练</h2>
              <p>徽章从训练记录开始。每一次时长、拍数、速度和心率，都会成为徽章的一部分。</p>
            </div>
            <div className="session-rail mint-session-rail" aria-label="数据源选择">
              {metrics.map((metric, index) => (
                <button key={metric.id} className={index === selectedIdx ? "active" : ""} onClick={() => setSelectedIdx(index)} type="button">
                  <span>{metric.label}</span>
                  <small>{cnDate(metric.date)}</small>
                </button>
              ))}
            </div>
            <div className="mint-story-actions">
              <button type="button" onClick={() => setMintStep("data")}>下一步</button>
            </div>
          </section>
        )}

        {mintStep === "data" && (
          <section className="mint-page">
            <div className="mint-page-copy">
              <span>Step 02</span>
              <h2>数据化作图形</h2>
              <p>你可以微调本次训练数据。数值会映射为密度、延展、起伏和高光。</p>
            </div>
            <div className="data-form mint-data-form">
              <label>
                训练时间
                <input type="datetime-local" value={mintForm.timestamp} onChange={(event) => updateMintForm("timestamp", event.target.value)} required />
                <span>本次训练的时间指纹</span>
              </label>
              <label>
                训练时长
                <input type="number" min="1" step="1" value={mintForm.durationMin} onChange={(event) => updateMintForm("durationMin", Number(event.target.value))} required />
                <span>决定螺旋延展长度</span>
              </label>
              <label>
                总拍数
                <input type="number" min="1" step="1" value={mintForm.totalShots} onChange={(event) => updateMintForm("totalShots", Number(event.target.value))} required />
                <span>影响条带密度</span>
              </label>
              <label>
                拍速均值
                <input type="number" min="1" step="0.1" value={mintForm.avgSpeed} onChange={(event) => updateMintForm("avgSpeed", Number(event.target.value))} required />
                <span>推动旋转张力</span>
              </label>
              <label>
                轨迹顶点
                <input type="number" min="0.1" max="5" step="0.01" value={mintForm.avgApex} onChange={(event) => updateMintForm("avgApex", Number(event.target.value))} required />
                <span>改变空间起伏</span>
              </label>
              <label>
                心率峰值
                <input type="number" min="60" max="220" step="1" value={mintForm.peakHr} onChange={(event) => updateMintForm("peakHr", Number(event.target.value))} required />
                <span>控制高光强度</span>
              </label>
            </div>
            <div className="mint-story-actions">
              <button type="button" className="secondary" onClick={() => setMintStep("session")}>返回</button>
              <button type="button" onClick={() => setMintStep("visual")}>下一步</button>
            </div>
          </section>
        )}

        {mintStep === "visual" && (
          <section className="mint-page">
            <div className="mint-page-copy">
              <span>Step 03</span>
              <h2>选择视觉语言</h2>
              <p>选择颜色倾向和叠加元素。它们经由生成算法，形成不同的配色、几何图层和训练指纹。</p>
            </div>
            <div className="mint-choice-group">
              <label>色彩气质</label>
              <div className="mint-choice-grid">
                {visualTones.map((tone) => (
                  <button key={tone.id} type="button" className={visualTone === tone.id ? "active" : ""} onClick={() => setVisualTone(tone.id)}>
                    <strong>{tone.label}</strong>
                    <span>{tone.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mint-choice-group">
              <label>叠加元素</label>
              <div className="mint-choice-grid">
                {visualElements.map((element) => (
                  <button key={element.id} type="button" className={visualElement === element.id ? "active" : ""} onClick={() => setVisualElement(element.id)}>
                    <strong>{element.label}</strong>
                    <span>{element.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="mint-error">{error}</p>}
            <div className="mint-story-actions">
              <button type="button" className="secondary" onClick={() => setMintStep("data")}>返回</button>
              <button type="submit" disabled={generating}>{generating ? "生成中..." : "生成徽章"}</button>
            </div>
          </section>
        )}

        {mintStep === "preview" && (
          <section className="mint-page">
            <div className="mint-page-copy">
              <span>Step 04</span>
              <h2>挑选你的徽章</h2>
              <p>本次训练已经生成三种徽章。选择与你状态最匹配的一枚，保存到个人画廊。</p>
            </div>
            <div className="mint-summary">
              <span>{selectedTone.label}</span>
              <span>{selectedElement.label}</span>
              <span>{currentSession.label}</span>
            </div>
            {candidates.length ? (
              <>
                <div className="candidate-list mint-candidate-list">
                  {candidates.map((cand, idx) => {
                    const isSelected = idx === selectedCandidateIdx;
                    return (
                      <button
                        key={cand.id}
                        type="button"
                        className={`candidate-option${isSelected ? " active" : ""}`}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedCandidateIdx(idx)}
                      >
                        <div className="candidate-preview">
                          <BadgeMark badge={cand} />
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedCandidate && (
                  <div className="mint-selected-caption">
                    <strong>{badgeTitle(selectedCandidate)}</strong>
                    <span>{selectedCandidate.totalShots} 拍 / {selectedCandidate.avgSpeed} km/h / {selectedCandidate.peakHr} bpm</span>
                  </div>
                )}
                {saveError && <p className="badge-save-error">{saveError}</p>}
              </>
            ) : (
              <div className="mint-empty-preview">
                <Sparkles size={24} />
                <span>还没有生成徽章</span>
              </div>
            )}
            <div className="mint-story-actions">
              <button type="button" className="secondary" onClick={() => setMintStep("visual")}>返回</button>
              {candidates.length ? (
                <button type="button" onClick={handleSaveSelected}>保存至个人画廊</button>
              ) : (
                <button type="submit" disabled={generating}>{generating ? "生成中..." : "生成徽章"}</button>
              )}
            </div>
          </section>
        )}
      </form>
    </div>
  );

  return (
    <div className="grid-view">
      <div className="wide-card" style={{ width: "100%" }}>
        <div className="muted" style={{ marginBottom: 8, fontSize: 13, fontWeight: "bold" }}>
          选择训练场次数据导入
        </div>
        <div className="session-rail" aria-label="数据源选择" style={{ marginBottom: 16 }}>
          {metrics.map((metric, index) => (
            <button key={metric.id} className={index === selectedIdx ? "active" : ""} onClick={() => setSelectedIdx(index)} type="button">
              <span>{metric.label}</span>
              <small>{cnDate(metric.date)}</small>
            </button>
          ))}
        </div>
      </div>

      <Card className="wide-card">
        <div className="card-title">
          <span>训练数据录入</span>
          <Plus size={20} />
        </div>
        <form key={selectedIdx} className="data-form" onSubmit={handleSubmit} ref={formRef}>
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
          <button type="submit" disabled={generating}>{generating ? "生成中..." : "开始铸造"}</button>
        </form>
        {error && <p style={{ color: "#ef4444", marginTop: 8, fontSize: 13 }}>{error}</p>}
      </Card>

      {candidates.length > 0 && (
        <ModalPortal>
        <div className="badge-modal-overlay" onClick={() => setCandidates([])}>
          <div className="badge-modal-card badge-candidate-modal" onClick={(e) => e.stopPropagation()}>
            <button className="badge-modal-close" onClick={() => setCandidates([])} type="button">
              <X size={16} />
            </button>
            <div className="badge-modal-title" style={{ marginBottom: 16 }}>
              <h3>铸造成功！</h3>
              <span>选择你要保存的徽章：</span>
            </div>
            
            <div className="candidate-list">
              {candidates.map((cand, idx) => {
                const isSelected = idx === selectedCandidateIdx;
                return (
                  <button
                    key={cand.id}
                    type="button"
                    className={`candidate-option${isSelected ? " active" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedCandidateIdx(idx)}
                  >
                    <div className="candidate-preview">
                      <BadgeMark badge={cand} />
                    </div>
                  </button>
                );
              })}
            </div>

            {saveError && <p className="badge-save-error">{saveError}</p>}

            <button
              className="button primary"
              type="button"
              onClick={handleSaveSelected}
              style={{
                width: "100%",
                minHeight: 46,
                borderRadius: 12,
                fontSize: 14,
                fontWeight: "bold",
                background: "var(--ink)",
                color: "#ffffff",
                border: "none",
                cursor: "pointer"
              }}
            >
              保存至个人画廊
            </button>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}

type CommunityBadge = {
  id: string;
  name: string;
  imageName: string;
  creator: string;
  comment: string;
  timestamp: number;
  durationMin: number;
  totalShots: number;
  avgSpeed: number;
  avgApex: number;
  peakHr: number;
  isCommunity: true;
};

const communityBadges: CommunityBadge[] = [
  {
    id: "comm-1",
    name: "Golden Spin Core",
    imageName: "ball.png",
    creator: "@TennisAce",
    comment: "在黄金时段的高强度上旋训练中铸造而成，强烈的旋转让球在空中拉出优美的轨迹！",
    timestamp: 1780281600000,
    durationMin: 75,
    totalShots: 1420,
    avgSpeed: 72,
    avgApex: 2.1,
    peakHr: 168,
    isCommunity: true,
  },
  {
    id: "comm-2",
    name: "Supernova Burst",
    imageName: "burst.png",
    creator: "@RafaFan",
    comment: "极限红土正手爆发！速度与旋转的完美交融，球落地后直接弹射起飞。",
    timestamp: 1779936000000,
    durationMin: 90,
    totalShots: 1650,
    avgSpeed: 84,
    avgApex: 1.6,
    peakHr: 182,
    isCommunity: true,
  },
  {
    id: "comm-3",
    name: "Cosmic Spark",
    imageName: "burst-1.png",
    creator: "@NovakD",
    comment: "反手直线突击，在底线最深区打出致命一击。这颗火花是给坚持者的勋章。",
    timestamp: 1780108800000,
    durationMin: 80,
    totalShots: 1520,
    avgSpeed: 78,
    avgApex: 1.3,
    peakHr: 175,
    isCommunity: true,
  },
  {
    id: "comm-4",
    name: "Claycourt Glide",
    imageName: "clay.png",
    creator: "@ClayKing",
    comment: "在滑步回球的侧身瞬间，捕捉到了属于红土赛季的独特律动。",
    timestamp: 1779676800000,
    durationMin: 120,
    totalShots: 2200,
    avgSpeed: 68,
    avgApex: 2.3,
    peakHr: 160,
    isCommunity: true,
  },
  {
    id: "comm-5",
    name: "Dust Particle",
    imageName: "clay-1.png",
    creator: "@SlideTennis",
    comment: "漫天飞扬的红土微尘，伴随着每一次重击，编织成了我们热爱的网球梦。",
    timestamp: 1779763200000,
    durationMin: 95,
    totalShots: 1800,
    avgSpeed: 70,
    avgApex: 2.2,
    peakHr: 165,
    isCommunity: true,
  },
  {
    id: "comm-6",
    name: "Championship Ochre",
    imageName: "clay-2.png",
    creator: "@RolandG",
    comment: "象征红土终极荣誉的赭石色，高弧度重上旋球是征服这片场地的关键。",
    timestamp: 1779849600000,
    durationMin: 110,
    totalShots: 1950,
    avgSpeed: 73,
    avgApex: 2.5,
    peakHr: 172,
    isCommunity: true,
  },
  {
    id: "comm-7",
    name: "Quantum Matrix",
    imageName: "core.png",
    creator: "@VidiCoach",
    comment: "量子级别的击球控制，将失误率限制在5%以内，这是一场艺术般的精准对决！",
    timestamp: 1780454400000,
    durationMin: 60,
    totalShots: 1100,
    avgSpeed: 82,
    avgApex: 1.4,
    peakHr: 158,
    isCommunity: true,
  },
  {
    id: "comm-8",
    name: "Midnight Shadow",
    imageName: "midnight.png",
    creator: "@NightOwl",
    comment: "凌晨时分，球场灯光下的寂静轰鸣。球速极快，犹如深夜里的魅影。",
    timestamp: 1779072000000,
    durationMin: 50,
    totalShots: 980,
    avgSpeed: 80,
    avgApex: 1.2,
    peakHr: 164,
    isCommunity: true,
  },
  {
    id: "comm-9",
    name: "Dark Nebula",
    imageName: "midnight-2.png",
    creator: "@LunaShot",
    comment: "深邃的墨绿色球网前，每一次截击都像流星划过夜空般璀璨。",
    timestamp: 1779158400000,
    durationMin: 70,
    totalShots: 1300,
    avgSpeed: 76,
    avgApex: 1.5,
    peakHr: 159,
    isCommunity: true,
  },
  {
    id: "comm-10",
    name: "Morning Dew",
    imageName: "morning.png",
    creator: "@EarlyBird",
    comment: "清晨第一缕晨曦，空气中弥漫着清新的露水香气，发球状态出奇地好！",
    timestamp: 1779417600000,
    durationMin: 60,
    totalShots: 1150,
    avgSpeed: 69,
    avgApex: 1.7,
    peakHr: 148,
    isCommunity: true,
  },
  {
    id: "comm-11",
    name: "Sunrise Aura",
    imageName: "morning-2.png",
    creator: "@DawnPlayer",
    comment: "朝阳映射在旋转的网球上，拉出金黄色的弧线，充满了崭新一天的活力。",
    timestamp: 1779504000000,
    durationMin: 85,
    totalShots: 1600,
    avgSpeed: 71,
    avgApex: 1.9,
    peakHr: 154,
    isCommunity: true,
  },
  {
    id: "comm-12",
    name: "Alpine Apex",
    imageName: "mount.png",
    creator: "@HighAlt",
    comment: "在高原球场进行的极限体能拉锯战，空气稀薄但斗志高昂！",
    timestamp: 1778812800000,
    durationMin: 100,
    totalShots: 1750,
    avgSpeed: 74,
    avgApex: 2.0,
    peakHr: 178,
    isCommunity: true,
  },
  {
    id: "comm-13",
    name: "Sonic Wave",
    imageName: "sonic.png",
    creator: "@Speedy",
    comment: "击球声清脆如音爆，发球直接得分（Ace）的瞬间，声波在空气中激荡。",
    timestamp: 1778467200000,
    durationMin: 45,
    totalShots: 850,
    avgSpeed: 96,
    avgApex: 1.1,
    peakHr: 166,
    isCommunity: true,
  },
  {
    id: "comm-14",
    name: "Supersonic Flare",
    imageName: "sonic-1.png",
    creator: "@FlashServe",
    comment: "打破个人最快发球时速纪录！完美的抛球与发力让球如闪电般穿透对手防线。",
    timestamp: 1778553600000,
    durationMin: 55,
    totalShots: 920,
    avgSpeed: 102,
    avgApex: 1.0,
    peakHr: 170,
    isCommunity: true,
  },
  {
    id: "comm-15",
    name: "Plasma Vector",
    imageName: "sonic-3.png",
    creator: "@VoltPlayer",
    comment: "电光石火间的高速对攻战，球路飘忽不定，将反射神经逼近极限。",
    timestamp: 1778726400000,
    durationMin: 75,
    totalShots: 1380,
    avgSpeed: 88,
    avgApex: 1.5,
    peakHr: 174,
    isCommunity: true,
  },
];

function MineView({
  badges,
  setBadges,
  setView,
  setSubView,
  setSelected,
  metrics,
}: {
  badges: StoredBadge[];
  setBadges: React.Dispatch<React.SetStateAction<StoredBadge[]>>;
  setView: (v: ViewId) => void;
  setSubView: (sv: OverviewSubView) => void;
  setSelected: (idx: number) => void;
  metrics: SessionMetric[];
}) {
  const [mineTab, setMineTab] = React.useState<"collection" | "community">("collection");
  const [collectionFilter, setCollectionFilter] = React.useState<CollectionFilter>("all");
  const [featuredBadgeIds, setFeaturedBadgeIds] = React.useState<string[]>(() => readFeaturedBadgeIds());
  const [heroIndex, setHeroIndex] = React.useState(0);
  const [selectedBadge, setSelectedBadge] = React.useState<StoredBadge | CommunityBadge | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  const visibleBadges = React.useMemo(
    () => badges.filter((badge) => matchesCollectionFilter(badge, collectionFilter)),
    [badges, collectionFilter],
  );
  const featuredOwnBadges = React.useMemo(
    () => badges.filter((badge) => featuredBadgeIds.includes(badge.id)),
    [badges, featuredBadgeIds],
  );
  const heroItems = badges.length
    ? (featuredOwnBadges.length ? featuredOwnBadges : badges.slice(0, Math.min(3, badges.length)))
    : communityBadges.slice(0, 5);
  const heroBadge = heroItems[heroIndex % Math.max(heroItems.length, 1)];
  const usingCommunityHero = !badges.length;
  const usingDefaultHero = !!badges.length && !featuredOwnBadges.length;

  React.useEffect(() => {
    setHeroIndex(0);
  }, [heroItems.length]);

  React.useEffect(() => {
    if (heroItems.length <= 1) return;
    const id = window.setInterval(() => {
      setHeroIndex((index) => (index + 1) % heroItems.length);
    }, 4200);
    return () => window.clearInterval(id);
  }, [heroItems.length]);

  function handleClear() {
    localStorage.removeItem(badgeStorageKey);
    localStorage.removeItem(featuredBadgeStorageKey);
    setFeaturedBadgeIds([]);
    setBadges([]);
  }

  function toggleFeaturedBadge(badgeId: string) {
    setFeaturedBadgeIds((current) => {
      const next = current.includes(badgeId)
        ? current.filter((id) => id !== badgeId)
        : [...current, badgeId];
      localStorage.setItem(featuredBadgeStorageKey, JSON.stringify(next));
      return next;
    });
  }

  function handleSave() {
    if (!selectedBadge) return;
    try {
      const badgeToSave = commBadge ? communityBadgeToStoredBadge(commBadge) : storeBadge;
      if (!badgeToSave) return;
      saveBadgeToGallery(badgeToSave);
      setBadges(readBadges());
      setToast("已保存至本地画廊");
    } catch (err) {
      setToast(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      window.setTimeout(() => setToast(null), 2200);
    }
  }

  function handleShare() {
    setToast("生成分享链接...");
    setTimeout(() => {
      setToast("分享链接已复制到剪贴板");
      setTimeout(() => setToast(null), 2000);
    }, 600);
  }

  function getAssociatedSessionIndex(badge: StoredBadge | CommunityBadge): number {
    if (!metrics || metrics.length === 0) return 0;
    
    // 1. Try exact sessionId match
    if ("sessionId" in badge && badge.sessionId) {
      const idx = metrics.findIndex((m) => m.id === badge.sessionId);
      if (idx !== -1) return idx;
    }

    // 2. Try date/time match
    try {
      const badgeDateStr = new Date(badge.timestamp).toISOString().slice(0, 10);
      const dateMatched = metrics.findIndex((m) => m.date === badgeDateStr);
      if (dateMatched !== -1) return dateMatched;
    } catch { /* ignore date parse issues */ }

    // 3. Fall back to metrics matching
    const matched = metrics.findIndex(
      (m) => m.shots === badge.totalShots || m.maxHr === badge.peakHr
    );
    if (matched !== -1) return matched;
    
    // 4. Fall back to hashing or ID match
    if (badge.id) {
      const matchId = String(badge.id).match(/comm-(\d+)/);
      if (matchId) {
        return (parseInt(matchId[1], 10) - 1) % metrics.length;
      }
      let hash = 0;
      const str = String(badge.id);
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      return Math.abs(hash) % metrics.length;
    }
    return 0;
  }

  const sessionIdx = selectedBadge ? getAssociatedSessionIndex(selectedBadge) : 0;
  const sessionLabel = `S${sessionIdx + 1}`;

  function handleJumpToData() {
    setSelected(sessionIdx);
    setSubView("overview");
    setView("overview");
    setSelectedBadge(null);
  }

  const isComm = !!(selectedBadge as any)?.isCommunity;
  const commBadge = isComm ? (selectedBadge as CommunityBadge) : null;
  const storeBadge = !isComm ? (selectedBadge as StoredBadge) : null;

  return (
    <div className="mine-view" style={{ padding: "0 4px" }}>
      {heroBadge && (
        <section className="badge-hero" aria-label="主页徽章视觉中心">
          <button className="badge-hero-stage" onClick={() => setSelectedBadge(heroBadge)} type="button">
            <div className="badge-hero-art">
              {"isCommunity" in heroBadge ? (
                <img src={new URL(`./Pics/${heroBadge.imageName}`, import.meta.url).href} alt={heroBadge.name} />
              ) : heroBadge.communityImageName ? (
                <img src={new URL(`./Pics/${heroBadge.communityImageName}`, import.meta.url).href} alt={badgeTitle(heroBadge)} />
              ) : (
                <BadgeMark badge={heroBadge} />
              )}
            </div>
            <div className="badge-hero-copy">
              <span>{usingCommunityHero ? "社区灵感" : usingDefaultHero ? "最近收藏" : "首页轮播"}</span>
              <strong>{"isCommunity" in heroBadge ? heroBadge.name : badgeTitle(heroBadge)}</strong>
            </div>
          </button>
          {heroItems.length > 1 && (
            <div className="badge-hero-dots" aria-label="轮播进度">
              {heroItems.map((item, index) => (
                <button
                  key={item.id}
                  className={index === heroIndex % heroItems.length ? "active" : ""}
                  onClick={() => setHeroIndex(index)}
                  type="button"
                  aria-label={`显示第 ${index + 1} 枚徽章`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="sub-tabs" aria-label="我的子导航" style={{ marginBottom: 20 }}>
        <button
          className={mineTab === "collection" ? "active" : ""}
          onClick={() => setMineTab("collection")}
          type="button"
        >
          <span>我的收藏 ({badges.length})</span>
        </button>
        <button
          className={mineTab === "community" ? "active" : ""}
          onClick={() => setMineTab("community")}
          type="button"
        >
          <span>社区画廊</span>
        </button>
      </div>

      {mineTab === "collection" ? (
        badges.length ? (
          <>
            <div className="badge-filter-bar" aria-label="徽章分类">
              {collectionFilters.map((filter) => (
                <button
                  key={filter.id}
                  className={collectionFilter === filter.id ? "active" : ""}
                  onClick={() => setCollectionFilter(filter.id)}
                  type="button"
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="badge-grid-single" aria-label="本地生成徽章">
              {visibleBadges.map((badge) => (
                <figure key={badge.id} className="badge-tile" onClick={() => setSelectedBadge(badge)} style={{ cursor: "pointer" }}>
                  {badge.communityImageName ? (
                    <div className="badge-community-img-wrap">
                      <img src={new URL(`./Pics/${badge.communityImageName}`, import.meta.url).href} alt={badgeTitle(badge)} />
                    </div>
                  ) : (
                    <BadgeMark badge={badge} />
                  )}
                  <figcaption>
                    <strong>{new Date(badge.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong>
                    <span>{new Date(badge.timestamp).toLocaleDateString("zh-CN")}</span>
                  </figcaption>
                  <button
                    className={`badge-feature-toggle${featuredBadgeIds.includes(badge.id) ? " active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFeaturedBadge(badge.id);
                    }}
                    type="button"
                  >
                    {featuredBadgeIds.includes(badge.id) ? "首页轮播中" : "加入首页轮播"}
                  </button>
                </figure>
              ))}
            </div>
            {!visibleBadges.length && (
              <p className="muted" style={{ textAlign: "center", marginTop: 32 }}>当前分类下还没有徽章。</p>
            )}
            <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
              <button className="data-form button secondary" style={{ minHeight: 24, borderRadius: 12, padding: "0 24px", fontSize: 14, fontWeight: "bold" }} onClick={handleClear}>
                清除历史记录
              </button>
            </div>
          </>
        ) : (
          <p className="muted" style={{ textAlign: "center", marginTop: 48 }}>还没有徽章，去铸造一枚吧。</p>
        )
      ) : (
        <div className="badge-grid-double" aria-label="社区徽章画廊">
          {communityBadges.map((badge) => (
            <figure key={badge.id} className="badge-tile" onClick={() => setSelectedBadge(badge)} style={{ cursor: "pointer" }}>
              <div className="badge-community-img-wrap">
                <img src={new URL(`./Pics/${badge.imageName}`, import.meta.url).href} alt={badge.name} />
              </div>
              <figcaption>
                <strong>{badge.name}</strong>
                <span>{badge.creator}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {selectedBadge && (
        <ModalPortal>
        <div className="badge-modal-overlay" onClick={() => setSelectedBadge(null)}>
          <div className="badge-modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="badge-modal-close" onClick={() => setSelectedBadge(null)} type="button">
              <X size={16} />
            </button>
            <BadgeCoin badge={selectedBadge} />
            <div className="badge-modal-title">
              <h3>{commBadge ? commBadge.name : storeBadge && badgeTitle(storeBadge)}</h3>
              <span>{commBadge ? `由 ${commBadge.creator} 创作的社区创意徽章` : storeBadge?.communityCreator ? `由 ${storeBadge.communityCreator} 创作的社区创意徽章` : "已铸造数字化训练徽章"}</span>
            </div>
            <div className="badge-modal-stats">
              <div className="badge-modal-stat-item">
                <label>训练日期</label>
                <span>{new Date(selectedBadge.timestamp).toLocaleDateString("zh-CN")}</span>
              </div>
              <div className="badge-modal-stat-item">
                <label>训练时间</label>
                <span>{new Date(selectedBadge.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="badge-modal-stat-item">
                <label>训练时长</label>
                <span>{selectedBadge.durationMin || 60} 分钟</span>
              </div>
              <div className="badge-modal-stat-item">
                <label>总拍数</label>
                <span>{selectedBadge.totalShots || 1200} 拍</span>
              </div>
              <div className="badge-modal-stat-item">
                <label>均速</label>
                <span>{selectedBadge.avgSpeed || 65} km/h</span>
              </div>
              <div className="badge-modal-stat-item">
                <label>均顶点高</label>
                <span>{selectedBadge.avgApex || 1.8} m</span>
              </div>
              <div className="badge-modal-stat-item">
                <label>峰值心率</label>
                <span>{selectedBadge.peakHr || 155} bpm</span>
              </div>
              {commBadge || storeBadge?.communityImageName ? (
                <div className="badge-modal-stat-item">
                  <label>来源</label>
                  <span>社区画廊</span>
                </div>
              ) : (
                storeBadge && (
                  <div className="badge-modal-stat-item">
                    <label>线宽 / 变点</label>
                    <span>{storeBadge.strokeWidth.toFixed(1)} / {storeBadge.variation.toFixed(2)}</span>
                  </div>
                )
              )}
            </div>

            {(commBadge || storeBadge?.communityComment) && (
              <div className="badge-modal-comment">
                <label>{commBadge ? commBadge.creator : storeBadge?.communityCreator}</label>
                <p>“{commBadge ? commBadge.comment : storeBadge?.communityComment}”</p>
              </div>
            )}

            {toast && (
              <div style={{
                fontSize: 12,
                fontWeight: "bold",
                color: "var(--ink)",
                background: "rgba(30, 58, 47, 0.08)",
                padding: "6px 16px",
                borderRadius: 12,
                marginTop: 4,
                textAlign: "center",
                width: "100%",
                animation: "fadeIn 0.2s ease both"
              }}>
                {toast}
              </div>
            )}

            <button className="badge-modal-jump-btn" onClick={handleJumpToData} type="button">
              <LineChart size={16} />
              <span>查看该场数据</span>
            </button>

            <div className="badge-modal-actions">
              <button className="secondary" onClick={handleSave} type="button">
                <Download size={16} />
                <span>保存</span>
              </button>
              <button className="primary" onClick={handleShare} type="button">
                <Share2 size={16} />
                <span>分享</span>
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}

function badgeTitle(badge: StoredBadge) {
  if (badge.communityName) return badge.communityName;
  if (badge.curveType === "ringsBlack" || badge.id.includes("hiddenBlack")) return "Obsidian Vector Flow Field";
  if (badge.curveType === "rings" || badge.id.includes("hidden")) return "Iridescent Vector Flow Field";
  if (badge.curveType === "parametric3d") return "Standard Vector Flow Field";
  if (badge.curveType === "2d") return "Gosper 2D";
  return "Z-Order 3D";
}

function communityBadgeToStoredBadge(badge: CommunityBadge): StoredBadge {
  return {
    id: `saved-${badge.id}`,
    timestamp: badge.timestamp,
    durationMin: badge.durationMin,
    totalShots: badge.totalShots,
    avgSpeed: badge.avgSpeed,
    avgApex: badge.avgApex,
    peakHr: badge.peakHr,
    curveType: "parametric3d",
    mergedPoints: [],
    zorderPoints: [],
    ringPanels: [],
    colorStart: "hsl(154, 32%, 18%)",
    colorEnd: "hsl(154, 18%, 52%)",
    colorInverted: "rgb(255,255,255)",
    invertedPos: 0.5,
    strokeWidth: 1,
    opacity: 1,
    variation: 0,
    communityImageName: badge.imageName,
    communityName: badge.name,
    communityCreator: badge.creator,
    communityComment: badge.comment,
  };
}

function matchesCollectionFilter(badge: StoredBadge, filter: CollectionFilter) {
  if (filter === "all") return true;
  if (filter === "warm" || filter === "cool" || filter === "mono") {
    return badgeColorFamily(badge) === filter;
  }
  return badgeStyleFamily(badge) === filter;
}

function badgeStyleFamily(badge: StoredBadge): Extract<CollectionFilter, "standard" | "iridescent" | "obsidian"> {
  if (badge.curveType === "ringsBlack" || badge.id.includes("hiddenBlack")) return "obsidian";
  if (badge.curveType === "rings" || badge.id.includes("hidden")) return "iridescent";
  return "standard";
}

function badgeColorFamily(badge: StoredBadge): Extract<CollectionFilter, "warm" | "cool" | "mono"> {
  const color = badge.colorStart.trim();
  const hslMatch = color.match(/hsl\(([-\d.]+),\s*([-\d.]+)%/i);
  if (badge.curveType === "ringsBlack" || badge.id.includes("hiddenBlack")) return "mono";
  if (!hslMatch) {
    return color.includes("0, 0") || color.includes("255,255,255") ? "mono" : "cool";
  }

  const hue = ((Number(hslMatch[1]) % 360) + 360) % 360;
  const saturation = Number(hslMatch[2]);
  if (saturation < 12) return "mono";
  return hue < 70 || hue >= 300 ? "warm" : "cool";
}

function BadgeCoin({ badge }: { badge: StoredBadge | CommunityBadge }) {
  const [rotation, setRotation] = React.useState({ x: -8, y: 0 });
  const [dragging, setDragging] = React.useState(false);
  const dragRef = React.useRef({ active: false, x: 0, y: 0, startX: -8, startY: 0 });
  const isCommunity = "isCommunity" in badge && badge.isCommunity;
  const storedBadge = badge as StoredBadge;
  const communityImageName = isCommunity ? (badge as CommunityBadge).imageName : storedBadge.communityImageName;
  const title = isCommunity ? badge.name : badgeTitle(storedBadge);
  const subtitle = isCommunity ? (badge as CommunityBadge).creator : storedBadge.communityCreator ?? "Vidi Training NFT";
  const coinStyle = {
    "--coin-rx": `${rotation.x}deg`,
    "--coin-ry": `${rotation.y}deg`,
  } as React.CSSProperties;

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current = {
      active: true,
      x: event.clientX,
      y: event.clientY,
      startX: rotation.x,
      startY: rotation.y,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    setRotation({
      x: Math.max(-58, Math.min(58, dragRef.current.startX - dy * 0.42)),
      y: dragRef.current.startY + dx * 0.62,
    });
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    dragRef.current.active = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      className={`badge-coin${dragging ? " dragging" : ""}`}
      style={coinStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      role="img"
      aria-label={`${title} 双面纪念币`}
    >
      <div className="badge-coin-object">
        <div className="badge-coin-edge" aria-hidden="true">
          {Array.from({ length: 36 }, (_, index) => (
            <span
              key={index}
              style={{ "--edge-angle": `${index * 10}deg` } as React.CSSProperties}
            />
          ))}
        </div>
        <div className="badge-coin-face badge-coin-front">
          <div className="badge-coin-art">
            {communityImageName ? (
              <img src={new URL(`./Pics/${communityImageName}`, import.meta.url).href} alt={title} />
            ) : (
              <BadgeMark badge={badge as StoredBadge} />
            )}
          </div>
        </div>
        <div className="badge-coin-face badge-coin-back">
          <div className="badge-coin-back-ring" />
          <div className="badge-coin-back-copy">
            <span>VIDI NFT</span>
            <strong>{title}</strong>
            <small>{subtitle}</small>
            <small>{new Date(badge.timestamp).toLocaleDateString("zh-CN")}</small>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <article ref={ref} className={`card ${className}`}>{children}</article>;
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
  if (metrics.length === 1) {
    return (
      <svg className="sparkline" viewBox="0 0 200 100">
        <path d="M8 84H192 M8 20H192" className="grid-line" />
        <circle cx={100} cy={50} r={6} fill="var(--ink)" />
      </svg>
    );
  }
  const max = Math.max(...metrics.map((metric) => metric.mistakeRate));
  const min = Math.min(...metrics.map((metric) => metric.mistakeRate));
  const points = metrics.map((metric, index) => {
    const x = 8 + (index / (metrics.length - 1)) * 184;
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
        return <text key={label} x={center + Math.cos(angle) * 70} y={center + Math.sin(angle) * 70 + 3} textAnchor="middle">{label}</text>;
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
              bottom: `${14 + point.heightM * 16}%`,
              transform: `translateZ(0) rotate(${index % 2 ? -18 : 18}deg)`,
            }}
            className={trajectory.stroke === "正手" ? "forehand" : ""}
          />
        );
      })}
    </div>
  );
}

const BadgeMark = React.memo(function BadgeMark({ badge }: { badge: StoredBadge }) {
  const size = 200;
  const pad = 10;
  const uid = badge.id;

  // Defensive: if data is malformed, render a placeholder ring
  if (!Array.isArray(badge.mergedPoints) || !Array.isArray(badge.zorderPoints)) {
    return (
      <svg className="badge-mark" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="训练数据徽章">
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 4} className="badge-ring" />
      </svg>
    );
  }

  function fitFrame(points: [number, number][]) {
    if (!points.length) {
      return { cx: 0.5, cy: 0.5, scale: 1 };
    }
    const minX = Math.min(...points.map((p) => p[0]));
    const maxX = Math.max(...points.map((p) => p[0]));
    const minY = Math.min(...points.map((p) => p[1]));
    const maxY = Math.max(...points.map((p) => p[1]));
    const width = Math.max(0.001, maxX - minX);
    const height = Math.max(0.001, maxY - minY);
    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      scale: Math.min(1.18, 0.82 / Math.max(width, height)),
    };
  }

  function fitCircleFrame(points: [number, number][]) {
    if (!points.length) {
      return { cx: 0.5, cy: 0.5, scale: 1 };
    }
    const minX = Math.min(...points.map((p) => p[0]));
    const maxX = Math.max(...points.map((p) => p[0]));
    const minY = Math.min(...points.map((p) => p[1]));
    const maxY = Math.max(...points.map((p) => p[1]));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const maxRadius = Math.max(
      0.001,
      ...points.map((p) => Math.hypot(p[0] - cx, p[1] - cy)),
    );
    return {
      cx,
      cy,
      scale: Math.min(1.16, 0.43 / maxRadius),
    };
  }

  function ptsToPath(points: [number, number][], frame = fitFrame(points)): string {
    if (!points.length) return "";
    return points.map((p, i) => {
      const [x, y] = pointToCanvas(p, frame);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }

  function pointToCanvas(point: [number, number], frame: { cx: number; cy: number; scale: number }): [number, number] {
    const fittedX = (point[0] - frame.cx) * frame.scale + 0.5;
    const fittedY = (point[1] - frame.cy) * frame.scale + 0.5;
    return [
      fittedX * (size - pad * 2) + pad,
      fittedY * (size - pad * 2) + pad,
    ];
  }

  // Inverted color accent segment around invertedPos
  function accentPath(points: [number, number][], pos: number, width: number, frame = fitFrame(points)): string {
    if (points.length < 10) return "";
    const idx = Math.floor(pos * (points.length - 1));
    const half = Math.max(3, Math.floor(width * points.length / 2));
    const slice = points.slice(Math.max(0, idx - half), Math.min(points.length, idx + half));
    return ptsToPath(slice, frame);
  }

  const curveFrame = badge.curveType === "2d" ? fitFrame(badge.mergedPoints) : undefined;
  const curvePath = badge.curveType === "2d"
    ? ptsToPath(badge.mergedPoints, curveFrame)
    : "";

  // 3D: project z-order points to 2D with perspective
  function projectZorder(points: [number, number, number][], offset: number): [number, number][] {
    return points.map((p) => {
      const depth = 1.55;
      const scale = 0.9 + (1 - p[2]) * 0.12 * depth;
      const drift = (p[2] - 0.5) * 0.16 * depth + offset;
      return [
        (p[0] - 0.5) * scale + 0.5 + drift * 0.34,
        (p[1] - 0.5) * scale + 0.5 - drift * 0.22,
      ];
    });
  }

  const zLayerCount = badge.curveType === "3d" ? 2 : 0;
  const zLayerOffsets = Array.from({ length: zLayerCount }, (_, index) => (index - (zLayerCount - 1) / 2) * 0.046);
  const zVisiblePoints = badge.curveType === "3d" ? badge.zorderPoints.slice(0, Math.min(badge.zorderPoints.length, 48)) : [];
  const zProjected = badge.curveType === "3d" ? zLayerOffsets.flatMap((offset) => projectZorder(zVisiblePoints, offset)) : [];
  const zFrame = fitCircleFrame(zProjected);
  const zAccent = badge.curveType === "3d" ? ptsToPath(projectZorder(zVisiblePoints.slice(
    Math.max(0, Math.floor(badge.invertedPos * zVisiblePoints.length) - 8),
    Math.min(zVisiblePoints.length, Math.floor(badge.invertedPos * zVisiblePoints.length) + 10),
  ), zLayerOffsets[zLayerOffsets.length - 1] || 0), zFrame) : "";
  const ringPanels = badge.ringPanels ?? [];
  const isRingBadge = badge.curveType === "rings" || badge.curveType === "ringsBlack";
  const isBlackRing = badge.curveType === "ringsBlack";
  const isParametric = badge.curveType === "parametric3d";
  const hasRingBackground = ringPanels.length > 0;
  const isWhiteCurve = badge.colorStart.includes("255");
  const regularBackground = isWhiteCurve ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)";
  const contrastStroke = isWhiteCurve ? "rgba(0,0,0,0.86)" : "rgba(255,255,255,0.9)";
  const ringFrameBase = hasRingBackground
    ? fitCircleFrame(ringPanels.flatMap((panel) => panel.points))
    : undefined;
  const ringFrame = isParametric
    ? undefined
    : (ringFrameBase && !isRingBadge
      ? { ...ringFrameBase, scale: ringFrameBase.scale * 1.41 }
      : ringFrameBase);
  function panelPoints(panel: NonNullable<BadgeData["ringPanels"]>[number], frame = ringFrame) {
    const activeFrame = frame ?? { cx: 0.5, cy: 0.5, scale: 1 };
    return panel.points.map((point) => {
      const fittedX = (point[0] - activeFrame.cx) * activeFrame.scale + 0.5;
      const fittedY = (point[1] - activeFrame.cy) * activeFrame.scale + 0.5;
      const x = fittedX * (size - pad * 2) + pad;
      const y = fittedY * (size - pad * 2) + pad;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }

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
        {isParametric ? (
          <>
            <circle cx={size / 2} cy={size / 2} r={size / 2 - 6} fill="#ffffff" />
            {ringPanels.map((panel, index) => (
              <polygon
                key={`param-${index}`}
                points={panelPoints(panel)}
                fill={panel.color}
                opacity={panel.opacity}
                stroke={panel.color}
                strokeWidth={0.25}
                strokeLinejoin="round"
              />
            ))}
          </>
        ) : (
          <>
            {!isRingBadge && (
              <circle cx={size / 2} cy={size / 2} r={size / 2 - 6} fill={regularBackground} />
            )}
            {!isRingBadge && hasRingBackground && (
              <g>
                {ringPanels.map((panel, index) => (
                  <polygon
                    key={`bg-${index}-${panel.front ? "f" : "b"}`}
                    points={panelPoints(panel)}
                    fill={panel.color}
                    opacity={1}
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth={0.42}
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            )}
            {isRingBadge ? (
              <>
                <circle cx={size / 2} cy={size / 2} r={size / 2 - 18} fill={isBlackRing ? "rgba(0,0,0,0.025)" : "rgba(255,255,248,0.18)"} />
                {ringPanels.map((panel, index) => (
                  <polygon
                    key={`${index}-${panel.front ? "f" : "b"}`}
                    points={panelPoints(panel)}
                    fill={panel.color}
                    opacity={panel.opacity}
                    stroke={isBlackRing ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.24)"}
                    strokeWidth={isBlackRing ? 0.35 : 0.6}
                    strokeLinejoin="round"
                  />
                ))}
                {!isBlackRing && (
                  <>
                    <ellipse cx={size / 2} cy={size * 0.5} rx={size * 0.34} ry={size * 0.12} className="badge-rings-orbit" />
                    <path d={`M${size * 0.22},${size * 0.36} C${size * 0.42},${size * 0.2} ${size * 0.66},${size * 0.74} ${size * 0.82},${size * 0.48}`} className="badge-sheen" opacity={0.28} />
                  </>
                )}
              </>
            ) : badge.curveType === "2d" ? (
              <>
                <path d={curvePath} fill="none" stroke={contrastStroke} strokeWidth={badge.strokeWidth * 2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.72} />
                <path d={curvePath} fill="none" stroke={badge.colorStart} strokeWidth={badge.strokeWidth * 1.55} strokeLinecap="round" strokeLinejoin="round" opacity={1} />
              </>
            ) : (
              <>
                {zLayerOffsets.map((offset, index) => (
                  <path
                    key={offset}
                    d={ptsToPath(projectZorder(zVisiblePoints, offset), zFrame)}
                    fill="none"
                    stroke={index === 0 ? contrastStroke : badge.colorStart}
                    strokeWidth={badge.strokeWidth * (index === 0 ? 2.4 : 1.55)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={index === 0 ? 0.72 : 1}
                  />
                ))}
              </>
            )}
          </>
        )}
      </g>
    </svg>
  );
});

function readBadges(): StoredBadge[] {
  try {
    const stored = JSON.parse(localStorage.getItem(badgeStorageKey) || "[]") as unknown;
    if (!Array.isArray(stored)) {
      return [];
    }
    return stored.filter(isStoredBadge);
  } catch {
    return [];
  }
}

function readFeaturedBadgeIds(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(featuredBadgeStorageKey) || "[]") as unknown;
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveBadgeToGallery(badge: StoredBadge) {
  const existing = readBadges().filter((item) => item.id !== badge.id);
  const next = [badge, ...existing];
  const primary = next.slice(0, badgeStorageSoftLimit);

  try {
    localStorage.setItem(badgeStorageKey, JSON.stringify(primary));
    return;
  } catch (primaryError) {
    const fallback = next.slice(0, badgeStorageMinimum);
    try {
      localStorage.setItem(badgeStorageKey, JSON.stringify(fallback));
      return;
    } catch {
      throw new Error(
        primaryError instanceof DOMException && primaryError.name === "QuotaExceededError"
          ? "本地存储空间不足，已尝试保留最近 20 枚徽章但仍失败。"
          : primaryError instanceof Error
            ? primaryError.message
            : String(primaryError),
      );
    }
  }
}

function isStoredBadge(value: unknown): value is StoredBadge {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.timestamp === "number" &&
    (v.curveType === "2d" || v.curveType === "3d" || v.curveType === "rings" || v.curveType === "ringsBlack" || v.curveType === "parametric3d") &&
    Array.isArray(v.mergedPoints) &&
    Array.isArray(v.zorderPoints) &&
    (v.ringPanels === undefined || Array.isArray(v.ringPanels)) &&
    typeof v.colorStart === "string" &&
    typeof v.colorEnd === "string" &&
    typeof v.colorInverted === "string" &&
    typeof v.invertedPos === "number" &&
    typeof v.strokeWidth === "number" &&
    typeof v.opacity === "number" &&
    typeof v.variation === "number" &&
    (v.sessionId === undefined || typeof v.sessionId === "string") &&
    (v.communityImageName === undefined || typeof v.communityImageName === "string") &&
    (v.communityName === undefined || typeof v.communityName === "string") &&
    (v.communityCreator === undefined || typeof v.communityCreator === "string") &&
    (v.communityComment === undefined || typeof v.communityComment === "string")
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

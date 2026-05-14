# 网球训练数据说明

## 概述

`tennis_training_data/` 目录包含一名 NTRP 2.5-3 水平学员在 3 个月内进行的 **8 次训练** 的完整模拟数据，采用阶梯式进步曲线设计。

---

## 文件结构

```
tennis_training_data/
├── summary.json                    # 汇总统计报告
├── session_001_20260411/           # 第1次训练（全面评估）
│   ├── training_data.json         # 完整训练数据
│   └── session_summary.json       # 本次训练摘要
├── session_002_20260422/           # 第2次训练（正手强化）
│   ├── training_data.json
│   └── session_summary.json
├── session_003_20260508/           # 第3次训练（反手强化）
├── session_004_20260514/           # 第4次训练（网前技术）
├── session_005_20260526/           # 第5次训练（发球接发）
├── session_006_20260604/           # 第6次训练（移动步伐）
├── session_007_20260618/           # 第7次训练（战术组合）
└── session_008_20260627/           # 第8次训练（综合考核）
```

---

## 数据结构

### 1. summary.json - 汇总统计

| 字段 | 类型 | 说明 |
|------|------|------|
| generated_at | string | 数据生成时间 |
| total_sessions | number | 训练总场次（8次） |
| time_span | object | 时间跨度信息 |
| player | object | 学员基本信息 |
| progress_curve | object | 进步曲线配置 |
| sessions_summary | array | 各次训练摘要列表 |
| overall_progress | object | 总体进步统计 |

#### time_span 对象

| 字段 | 类型 | 说明 |
|------|------|------|
| start_date | string | 起始日期 |
| end_date | string | 结束日期 |
| total_days | number | 总天数（77天） |

#### sessions_summary 单项

| 字段 | 类型 | 说明 |
|------|------|------|
| session_id | string | 训练场次 ID |
| date | string | 训练日期时间 |
| theme | string | 训练主题 |
| total_shots | number | 总击球数 |
| total_rallies | number | 总回合数 |
| player_shots | number | 学员击球数 |
| player_mistakes | number | 学员失误数 |
| actual_mistake_rate | number | 实际失误率 |
| progress_status | string | 进步状态 |
| energy_factor | number | 精力因子 |
| interval_factor | number | 间隔因子 |

---

### 2. training_data.json - 完整训练数据

```json
{
  "session": { ... },
  "shots": [ ... ],
  "heart_rate": { ... }
}
```

#### session - 训练会话元数据

| 字段 | 类型 | 说明 |
|------|------|------|
| session_id | string | 训练场次 ID |
| session_index | number | 训练序号 |
| date | string | 训练日期时间 (ISO 8601) |
| weekday | string | 星期几 |
| duration_minutes | number | 训练时长（60分钟） |
| theme | string | 训练主题 |
| description | string | 训练描述 |
| progress_status | string | 进步状态（初始水平/平台期/突破期/巩固期） |
| days_since_last | number | 距上次训练天数 |
| player | object | 学员信息 |
| coach | object | 教练信息 |
| court | object | 场地信息 |
| phases | array | 训练阶段列表 |
| total_rallies | number | 总回合数 |
| total_shots | number | 总击球数 |

#### shots - 击球记录数组

每条击球记录包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| shot_id | string | 击球唯一标识 |
| rally_id | number | 所属回合 ID |
| rally_count | number | 当前回合内击球序号 |
| timestamp | string | 击球时间戳 |
| time_delta_ms | number | 与上一拍时间间隔（毫秒） |
| phase | string | 所属训练阶段 |
| stroker | string | 击球者（coach/player） |
| stroke_type | string | 击球类型（正手/反手/发球/截击等） |
| incoming_ball | object | 来球信息 |
| outgoing_ball | object | 回球信息 |
| result | object | 击球结果 |

**incoming_ball 来球信息：**

| 字段 | 类型 | 说明 |
|------|------|------|
| from_position_x | number | 来球 X 坐标（米） |
| from_position_y | number | 来球 Y 坐标（米） |
| speed_kmh | number | 来球速度（km/h） |
| spin_type | string | 旋转类型（上旋/平击/下旋/无旋转） |
| spin_rpm | number | 转速（RPM） |

**outgoing_ball 回球信息：**

| 字段 | 类型 | 说明 |
|------|------|------|
| direction | string | 击球方向（斜线/直线/追身） |
| depth | string | 落点深度（浅/中等/深） |
| landing_x | number | 落点 X 坐标（米） |
| landing_y | number | 落点 Y 坐标（米） |
| speed_kmh | number | 回球速度（km/h） |
| spin_type | string | 旋转类型 |
| spin_rpm | number | 转速（RPM） |
| trajectory | object | 轨迹数据（失误时为 null） |

**trajectory 轨迹数据：**

| 字段 | 类型 | 说明 |
|------|------|------|
| apex_height_m | number | 球的最高点高度（米） |
| curve_points | array | 轨迹曲线关键点 |

**result 击球结果：**

| 字段 | 类型 | 说明 |
|------|------|------|
| is_mistake | boolean | 是否失误 |
| mistake_type | string | 失误类型（下网/出界/打框） |

#### heart_rate - 心率数据

以 `shot_id` 为 key，心率值（BPM）为 value 的键值对：

```json
{
  "S123456": 142,
  "S234567": 145,
  ...
}
```

---

### 3. session_summary.json - 训练摘要

单次训练的关键指标汇总，字段同 `summary.json` 中的 `sessions_summary` 单项。

---

## 坐标系说明

```
           球员侧 (Y > 0)
                ↑
                |
   ←←←←←←←←←←←← X轴 →→→→→→→→→→→→
                |
                ↓
           教练侧 (Y < 0)
```

- **X 轴**：球场宽度方向，范围约 [-5.485, 5.485] 米
- **Y 轴**：球场长度方向，正值朝向球员侧，负值朝向教练侧

---

## 训练主题说明

| 场次 | 日期 | 主题 | 训练内容 |
|------|------|------|----------|
| 1 | 04-11 | 全面评估 | 正手、反手、综合技术评估 |
| 2 | 04-22 | 正手强化 | 正手底线、正手移动 |
| 3 | 05-08 | 反手强化 | 反手底线、双反专项 |
| 4 | 05-14 | 网前技术 | 截击、高压球 |
| 5 | 05-26 | 发球接发 | 发球、接发球 |
| 6 | 06-04 | 移动步伐 | 左右移动、前后移动 |
| 7 | 06-18 | 战术组合 | 底线相持、变线进攻 |
| 8 | 06-27 | 综合考核 | 全技术测试、模拟比赛 |

---

## 进步曲线

采用**阶梯式进步**设计：

| 状态 | 训练场次 | 特征 |
|------|---------|------|
| 初始水平 | 1 | 失误率较高，技术不稳定 |
| 平台期 | 2, 3, 5, 6 | 技术稳定，进步缓慢 |
| 突破期 | 4, 7 | 技术突破，失误率明显下降 |
| 稳定期 | 8 | 技术巩固，表现稳定 |

**总体改进：32.2%**（失误率从 20.05% 降至 13.60%）

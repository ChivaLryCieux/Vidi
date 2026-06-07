# Vidi

网球训练智能分析平台。基于 [Tauri v2](https://v2.tauri.app/) 构建，前端使用 React + TypeScript + Three.js，后端使用 Rust。

Vidi 将网球训练数据转化为可生成的视觉徽章，计划中的 Web3 层允许每枚徽章铸造为 NFT。

当前应用已支持本地徽章生成与收藏。徽章系统设计为盲盒风格的 `Vidi Badge NFT` 系列：普通徽章由训练指标生成，稀有隐藏款使用受本地 `rings.lua` 生成器启发的矩形丝带环算法。

## 功能概览

- **总览**：训练效能指数、成长曲线、技术雷达、行动焦点
- **球场**：落点地图、3D 轨迹感知、击球类型分析
- **负荷**：训练负荷矩阵、阶段压力、恢复信号
- **铸造**：训练数据生成可验证的链上徽章（Gosper 曲线 / Z-Order 3D / 隐藏款）
- **我的**：钱包连接、徽章管理

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri v2 (WebView) |
| 前端 | React 18, TypeScript, Vite, Three.js, Lucide Icons |
| 后端 | Rust, Serde, serde_json |
| 构建系统 | Bazel (bzlmod) + Cargo + npm |
| CI/CD | GitHub Actions (Linux / Windows / macOS) |
| 移动端 | Android (Gradle + cargo-ndk), iOS (规划中) |

---

## Vidi Badge NFT

`Vidi Badge NFT` 是由网球训练数据驱动的生成艺术徽章系统。每枚徽章不是静态图片模板，而是由训练指标、铸造时间戳和确定性映射规则生成。

当前稀有度设计：

| 类型 | 概率 | 视觉结构 |
| --- | ---: | --- |
| 普通徽章 | 97.9% | 彩色环背景 + 粗黑/白训练曲线 |
| 隐藏款 | 2% | 完整矩形丝带环徽章 |
| 纯黑隐藏款 | 0.1% | 纯黑矩形丝带环徽章 |

### 训练数据映射

| 训练字段 | 徽章映射 |
| --- | --- |
| 训练时长 | 曲线长度、成长等级、旋转、环流数量 |
| 总拍数 | 笔触宽度、体积强度、环密度 |
| 平均速度 | 选择主曲线族和黑/白前景色 |
| 平均顶点高度 | 不透明度和空间扰动强度 |
| 心率峰值 | 沿生成路径的高光位置 |
| 系统时间戳 | SHA-256 种子，用于调色板、扰动和唯一性 |

普通徽章使用两种主曲线族：

- `Gosper 2D`：用于低速训练，生成连续六边形空间填充路径
- `Z-Order 3D`：用于高速训练，将紧凑的 3D Morton/Z-order 曲线投影到 2D

### DApp 方向

计划中的 DApp 流程：生成徽章 → 本地预览 → 连接钱包 → 序列化元数据 → 铸造 NFT → 市场上架。

---

## 构建系统

本项目使用 **Bazel** 作为统一构建编排层，管理前端（npm/Vite）和后端（Cargo）的完整构建流程。

### 为什么用 Bazel

- **增量构建**：只重建发生变化的部分，避免全量编译
- **远程缓存**：团队共享构建产物，CI 不重复编译
- **依赖图可视化**：`bazel query` 可以直观看到所有依赖关系
- **跨平台一致性**：同一份 BUILD 文件在 Linux/macOS/Windows 上行为一致
- **可复现性**：hermetic 构建模型确保相同输入产生相同输出

### 安装 Bazelisk

[Bazelisk](https://github.com/bazelbuild/bazelisk) 是 Bazel 的版本管理器，会自动下载 `.bazelversion` 中指定的版本。

```bash
# npm 安装（推荐）
npm install -g @bazel/bazelisk

# 验证安装（应输出 bazel 7.4.1）
bazel --version
```

### 构建命令

```bash
# TypeScript 类型检查（替代 tsc --noEmit）
bazel build //:typecheck

# 前端打包（替代 npm run build）
bazel build //:frontend

# Rust 编译（替代 cargo build）
bazel build //:backend

# 完整构建（前端 + 后端 + 静态资源）
bazel build //:tauri_bundle
```

### 依赖图

```bash
# 查看完整构建目标的依赖树
bazel query 'deps(//:tauri_bundle)' --output=build

# 生成依赖关系图（需要 graphviz）
bazel query 'deps(//:tauri_bundle)' --output=graph | dot -Tpng > deps.png

# 查看前端依赖
bazel query 'deps(//src:frontend_dist)'

# 查看 Rust 依赖
bazel query 'deps(//src-tauri:vidi)'
```

### 增量构建

Bazel 自动追踪文件变化，只重建受影响的目标：

```bash
# 修改 src/main.tsx 后，只有前端重新打包
bazel build //:tauri_bundle

# 修改 src-tauri/src/commands.rs 后，只有 Rust 重新编译
bazel build //:tauri_bundle
```

### 缓存管理

```bash
# 本地磁盘缓存默认在 ~/.cache/bazel-vidi
du -sh ~/.cache/bazel-vidi

# 清理缓存
bazel clean

# 清理所有（包括外部依赖）
bazel clean --expunge
```

### 项目结构（Bazel 视角）

```
Vidi/
├── MODULE.bazel                   # 模块定义：rules_rust, aspect_rules_js
├── BUILD.bazel                    # 根目标：tauri_bundle, typecheck, frontend, backend
├── .bazelversion                  # 固定 Bazel 版本
├── .bazelrc                       # 构建选项、平台配置、缓存设置
├── .bazelignore                   # 排除 node_modules, target 等
├── platforms/BUILD.bazel          # 跨平台 platform 定义
├── src/BUILD.bazel                # 前端：ts_project + vite 打包
├── src-tauri/BUILD.bazel          # 后端：rust_library + rust_binary
├── public/BUILD.bazel             # 静态资源：filegroup
└── tennis_training_data/BUILD.bazel  # 训练数据：filegroup (include_str!)
```

### Bazel 核心概念

| 概念 | 说明 | 本项目示例 |
|------|------|-----------|
| **Label** | 目标的唯一标识 `//package:target` | `//src:frontend_dist` |
| **Rule** | 构建规则，定义输入→输出的转换 | `ts_project`, `rust_binary`, `genrule` |
| **Target** | 一个规则实例 | `//:typecheck` |
| **Package** | 包含 BUILD 文件的目录 | `src/`, `src-tauri/` |
| **bzlmod** | Bazel 的模块管理系统 | `MODULE.bazel` 中的 `bazel_dep` |

---

## 开发模式（不使用 Bazel）

日常开发推荐使用 Tauri CLI，它提供热重载和 DevTools：

```bash
# 安装依赖
npm install

# 启动开发服务器（带热重载）
npm run tauri dev

# 生产构建
npm run tauri build

# 仅前端开发
npm run dev
```

## 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | >= 22 |
| Rust | stable |
| Bazel | 7.4.1 (由 .bazelversion 管理) |

### Linux 额外依赖

```bash
sudo apt install \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  libdbus-1-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev
```

## 项目标识

- **应用 ID**：`com.vidi.training`
- **版本**：`0.1.0`
- **窗口**：420×860，最小 360×640，背景色 `#f4f9ed`

# ShelfGuard

## What This Is

ShelfGuard 是一款跨平台 PWA 展架陈列即时巡检应用。门店员工在固定机位拍摄展架照片，与已建立的基准图比对，即时发现缺失（Missing）与位移（Displaced）异常。应用支持 5 个独立柜架，左右滑动切换，每个柜架拥有独立的基准图与巡检历史。v1 优先 100% 还原 PRD 三视图 UI/UX（相机主屏、基准标定、比对结果），设计规范对齐 Google Stitch 输出与 Minimalist Light 设计 Token。

## Core Value

用户能在 30 秒内完成一次展架巡检，并清晰看到「哪里缺了、哪里动了」——无需回办公室核对纸质清单。

## Requirements

### Validated

- ✓ 三视图 FSM 流程（相机 → ROI 标定 → 结果检视）— existing
- ✓ PWA 离线壳层与 Service Worker 自动更新 — existing
- ✓ IndexedDB 持久化基准图、巡检历史、语言与容差设置 — existing
- ✓ 幽灵覆层（Ghost View）基准图叠加与透明度调节 — existing
- ✓ 设备倾角水平仪（±1.5° 吸附 + 振动反馈）— existing
- ✓ 4 排 ROI 可拖动分割线标定 — existing
- ✓ 扫描线过渡动效（0.8s）— existing
- ✓ 结果页红黄框标注、长按 Blink Compare、Tap-to-Dismiss — existing
- ✓ 容差滑块实时调节 — existing
- ✓ 中/英双语切换 — existing
- ✓ 闪光灯切换、上次巡检缩略图入口 — existing

### Active

- [ ] 5 柜架独立数据模型（基准图 + 巡检历史），左右滑动切换 UI
- [ ] UI/UX 100% 对齐 PRD 设计 Token（Minimalist Light、色彩体系、圆角、毛玻璃、投影）
- [ ] 三视图交互与动效完全匹配 PRD 规格（水平仪、扫描线、放大镜、统计胶囊等）
- [ ] Google Stitch 设计稿生成并与 React 实现对齐
- [ ] 迁移至 Next.js App Router（纯客户端 PWA，`"use client"`）
- [ ] 客户端图像差分（`@techstark/opencv-js` 或 Canvas 轻量像素库，按 4 排 ROI 分区比对）
- [ ] 首次引导流程（无基准图时 INITIAL_GUIDE）
- [ ] 修复已知缺陷（Demo 模式抓拍、Torch 状态、双快门竞态等）

### Out of Scope

- 后端用户认证与多门店 SaaS 管理 — v1 为单设备本地 PWA
- 实时视频流连续分析 — 仅拍照比对模式
- 商品 SKU 级识别与库存联动 — 超出陈列变动检测范围
- 原生 iOS/Android 应用 — PWA 优先，应用商店分发不在 v1

## Context

**Brownfield 起点：** 仓库已有 ShelfGuard React 19 + Vite 8 + Tailwind 4 原型，三视图与 IndexedDB 持久化已实现。视觉分析 `analyzeShelfCapture()` 当前为 Mock 数据（硬编码异常），未做真实图像处理。需迁移至 **Next.js App Router** 纯客户端 PWA 架构。

**技术栈约束（2026-09-20 确认）：**
- 框架：Next.js (App Router) + React 19 + TypeScript + Tailwind CSS
- 运行时：纯客户端 PWA（`"use client"`），无后端依赖，支持离线运行与本地保存
- 关键库：`idb-keyval`（IndexedDB 持久化）、`lucide-react`（图标）、`@techstark/opencv-js` 或端侧 Canvas 轻量像素操作库（如 pixelmatch）

**PRD 模块一：** Google Stitch 专用 UI/UX 设计规范与 Prompt，定义 Minimalist Light 设计语言、三视图详细交互、5 柜架滑动选择。

**用户决策（2026-09-20）：**
- 5 柜架：各自独立基准图 + 独立巡检历史，左右滑动切换
- 视觉检测：纯端侧 — `@techstark/opencv-js` 或 Canvas 轻量像素库，无后端
- Stitch 定位：Stitch 出稿 + 代码实现完全匹配 PRD
- v1 优先级：UI/UX 100% 还原 PRD（三视图 + 动效 + 多柜架）

## Constraints

- **Tech stack**: Next.js (App Router) + React 19 + TypeScript + Tailwind CSS — 从现有 Vite 原型迁移
- **Runtime**: 纯客户端 PWA — 所有交互组件 `"use client"`；无 Express/API Route/Server Action 业务逻辑；无后端依赖
- **Vision libs**: `@techstark/opencv-js` **或** 端侧 Canvas 轻量像素库（pixelmatch + Canvas 2D）；优先轻量方案，OpenCV 仅在需要 homography/高级 CV 时启用
- **Storage**: `idb-keyval` 持久化大分辨率基准图与 ROI 坐标
- **Icons**: `lucide-react`
- **Platform**: 浏览器 PWA，支持离线；相机/陀螺仪需 HTTPS 或 localhost
- **Design**: 严格遵循 PRD 色彩 Token（#FFFFFF, #F8FAFC, #0F172A, #10B981, #EF4444, #F59E0B 等）
- **Performance**: 扫描动效 0.8s；水平仪 ±1.5° 吸附；放大镜 2x 80px 圆形
- **Storage**: IndexedDB 本地存储，5 柜架数据隔离
- **i18n**: 中/英双语（现有 I18N 体系扩展）

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 5 柜架独立基准 + 历史 | 每个物理柜架拍摄位置与基准不同，需隔离数据 | — Pending |
| 纯端侧视觉检测（无后端） | 用户约束：无后端依赖，离线可用 | — Pending |
| Next.js App Router 迁移 | 用户指定框架；Vite 原型作为迁移源 | — Pending |
| Canvas 轻量像素库优先 | bundle 更小；`@techstark/opencv-js` 为备选 | — Pending |
| v1 UI-first | 用户明确优先级：先还原 PRD 三视图与多柜架 | — Pending |
| Stitch 出稿 + 代码对齐 | 设计规范作为单一真相源，Stitch 生成 + React 实现 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-20 after tech stack constraint alignment*

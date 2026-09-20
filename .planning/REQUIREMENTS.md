# Requirements: ShelfGuard

**Defined:** 2026-09-20
**Core Value:** 用户能在 30 秒内完成一次展架巡检，并清晰看到「哪里缺了、哪里动了」

## v1 Requirements

### Tech Stack (TECH)

- [ ] **TECH-01**: 应用基于 Next.js (App Router) + React 19 + TypeScript + Tailwind CSS 构建
- [ ] **TECH-02**: 所有相机/Canvas/IndexedDB/设备 API 交互组件使用 `"use client"`，无 Server Component 业务逻辑
- [ ] **TECH-03**: 运行时无后端依赖 — 不部署 Express/API Route/Server Action 业务逻辑；移除 `@google/genai`、`express`、`dotenv` 等未用服务端依赖
- [ ] **TECH-04**: 使用 `idb-keyval` 持久化大分辨率基准图片、ROI 坐标、巡检历史与设置
- [ ] **TECH-05**: 使用 `lucide-react` 作为全局图标库
- [ ] **TECH-06**: 视觉差分使用 `@techstark/opencv-js` **或** 端侧 Canvas 轻量像素操作库（pixelmatch + Canvas 2D），在 Web Worker 中执行
- [ ] **TECH-07**: PWA 离线能力通过 Next.js 兼容方案实现（如 `@serwist/next` 或等效 SW 配置），Service Worker 仅缓存应用壳

### Design System (DSGN)

- [ ] **DSGN-01**: 应用全局使用 Minimalist Light 设计 Token（#FFFFFF/#F8FAFC 底色、#0F172A 主字色、#64748B 次字色、#E2E8F0 边框）
- [ ] **DSGN-02**: 状态色正确应用 — 就绪/成功 #10B981、缺失 #EF4444（加粗边框 + 15% 半透明红填充）、位移 #F59E0B（加粗边框 + 15% 半透明黄填充）
- [ ] **DSGN-03**: 控件形态统一 — rounded-2xl/rounded-full 大圆角、backdrop-blur-md bg-white/75 毛玻璃容器、shadow-sm 至 shadow-md 投影
- [ ] **DSGN-04**: Google Stitch 设计稿生成并与 React 实现视觉对齐（三视图截图对比验收）

### Multi-Shelf (SHLF)

- [ ] **SHLF-01**: 用户可在 5 个柜架间左右滑动切换，当前柜架指示清晰可见
- [ ] **SHLF-02**: 每个柜架拥有独立基准图（baseline），切换柜架时加载对应基准
- [ ] **SHLF-03**: 每个柜架拥有独立巡检历史，互不污染
- [ ] **SHLF-04**: 当前选中柜架 ID 持久化，重启应用后恢复上次选中柜架
- [ ] **SHLF-05**: 柜架无基准图时进入首次引导流程（INITIAL_GUIDE），而非静默使用 Demo 基准

### Camera Live View (CAM)

- [ ] **CAM-01**: 全屏展示后置广角摄像头实时画面（或 Demo 模式下的基准图流）
- [ ] **CAM-02**: 幽灵覆层（Ghost View）以默认 45% 透明度叠加基准图，右侧垂直条可调节透明度
- [ ] **CAM-03**: 中央十字水平仪 — 浅灰细十字准星；倾角 ±1.5° 内吸附居中变薄荷绿并短振
- [ ] **CAM-04**: 顶部悬浮栏 — 左：药丸按钮「基准图 (已建立)」弹出重设确认面板；中：水平状态微标；右：闪光灯 + 中/英切换
- [ ] **CAM-05**: 底部中央 76px 双环快门键，就绪时呼吸微光动效；右下上次巡检缩略图入口
- [ ] **CAM-06**: 快门后 0.8s 发光浅蓝扫描线自上而下扫过 4 排，随后淡入结果页
- [ ] **CAM-07**: iOS 设备方向权限在用户手势中请求，水平仪在 iOS 上可用
- [ ] **CAM-08**: 相机错误/权限拒绝时在 UI 中显示提示（非仅 console）
- [ ] **CAM-09**: Demo 模式抓拍时捕获当前显示帧（非固定 CDN URL）

### ROI Setup (ROI)

- [ ] **ROI-01**: 首次抓拍后展示高清基准大图作为标定背景
- [ ] **ROI-02**: 4 条可拖动水平分割线覆盖画面，切分 4 排展架横梁
- [ ] **ROI-03**: 分割线两端外突圆形拖动手柄，拖拽流畅
- [ ] **ROI-04**: 拖拽时手指上方 2.5cm 处悬浮 80px 直径 2x 圆形放大镜
- [ ] **ROI-05**: 底部操作栏 — 「重拍」「重置分段」「确认并保存基准」主按钮

### Result & Inspection (RSLT)

- [ ] **RSLT-01**: 当前照片全景展示，变动区域叠加红框（缺失）与黄框（位移）
- [ ] **RSLT-02**: 长按 Blink Compare — 隐藏框体并切换为基准原图，松手恢复
- [ ] **RSLT-03**: Tap-to-Dismiss — 轻点误报框体微缩淡出，计数相应减 1
- [ ] **RSLT-04**: 顶部统计胶囊 — 🔴 N 处缺失 🟡 N 处变动；点击颜色标签单独高亮该类异常
- [ ] **RSLT-05**: 底部浮动抽屉 — 横向容差滑块实时增减细小变动框
- [ ] **RSLT-06**: 「完成巡检（返回相机）」按钮返回当前柜架相机主屏

### Vision Analysis (VIS)

- [ ] **VIS-01**: 客户端 Canvas 像素差分按 4 排 ROI 分区执行，替换 Mock 硬编码异常
- [ ] **VIS-02**: 差分结果分类为 MISSING（缺失）与 DISPLACED（位移），输出带 bounding box 的异常列表
- [ ] **VIS-03**: 容差滑块变更时重新执行差分管线（非仅过滤预设 Mock）
- [ ] **VIS-04**: 差分在 Web Worker 中执行，不阻塞 0.8s 扫描动效 UI

### Storage & Data (DATA)

- [ ] **DATA-01**: IndexedDB 使用 namespaced keys（shelf:{0-4}:*）隔离 5 柜架数据
- [ ] **DATA-02**: 基准图以 JPEG Blob 存储（非 base64 DataURL），降低配额压力
- [ ] **DATA-03**: 旧版单 key 基准数据迁移至 shelf-1
- [ ] **DATA-04**: IndexedDB QuotaExceededError 在 UI 提示（非仅 console）
- [ ] **DATA-05**: 每柜架巡检历史有合理上限（建议 20 条）与缩略图压缩

### PWA & Platform (PWA)

- [ ] **PWA-01**: 应用可安装为 PWA，离线时完整巡检流程可用（客户端差分路径）
- [ ] **PWA-02**: Service Worker 仅缓存应用壳，不缓存用户拍摄图片
- [ ] **PWA-03**: 离线状态指示器在断网时可见

### App Stability (STAB)

- [ ] **STAB-01**: 快门双击竞态修复 — 800ms 动画期间禁止重复触发
- [ ] **STAB-02**: 闪光灯 UI 状态与硬件能力一致（不支持时不显示 ON）
- [ ] **STAB-03**: AppMode PROCESSING 在分析耗时超过扫描动画时使用
- [ ] **STAB-04**: 上传自定义基准图时更新 imageDimensions

### Internationalization (I18N)

- [ ] **I18N-01**: 中/英双语切换，所有三视图文案覆盖
- [ ] **I18N-02**: 语言偏好持久化至 IndexedDB

## v2 Requirements

### Vision Enhancement

- **VIS-05**: 可选云端 Vision API 精检（需后端，与纯客户端约束冲突 — 仅 v2+ 考虑）
- **VIS-06**: `@techstark/opencv-js` 高级 CV（homography、形态学）— 当 Canvas 轻量方案精度不足时升级
- **VIS-07**: 单应性（Homography）自动对齐 — 当 Ghost Overlay 不足时

### Reporting

- **RPT-01**: 导出/分享巡检报告（PDF 或图片）
- **RPT-02**: 每排独立容差预设

### Enterprise

- **ENT-01**: 多门店 SaaS 后台与用户认证
- **ENT-02**: SKU 级图像识别与库存联动
- **ENT-03**: HQ 仪表盘与跨店分析

## Out of Scope

| Feature | Reason |
|---------|--------|
| 实时视频流连续分析 | PRD 明确拍照比对模式；电池与复杂度 |
| 多门店 SaaS + 用户认证 | v1 单设备本地 PWA |
| SKU 级识别 | v2+；v1 区域级 missing/displaced 足够 |
| 原生 iOS/Android App | PWA 优先 |
| Express / API Route 业务逻辑 | 纯客户端 PWA 约束 |
| Gemini / 云端 Vision API | 无后端依赖；v2+ 若引入需独立后端 |
| Vite 生产构建 | 迁移至 Next.js App Router |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TECH-01 | Phase 1 | Pending |
| TECH-02 | Phase 1 | Pending |
| TECH-03 | Phase 1 | Pending |
| TECH-04 | Phase 2 | Pending |
| TECH-05 | Phase 1 | Pending |
| TECH-06 | Phase 4 | Pending |
| TECH-07 | Phase 1 | Pending |
| DSGN-01 | Phase 5 | Pending |
| DSGN-02 | Phase 5 | Pending |
| DSGN-03 | Phase 5 | Pending |
| DSGN-04 | Phase 5 | Pending |
| SHLF-01 | Phase 5 | Pending |
| SHLF-02 | Phase 2 | Pending |
| SHLF-03 | Phase 2 | Pending |
| SHLF-04 | Phase 2 | Pending |
| SHLF-05 | Phase 5 | Pending |
| CAM-01 | Phase 3 | Pending |
| CAM-02 | Phase 3 | Pending |
| CAM-03 | Phase 3 | Pending |
| CAM-04 | Phase 5 | Pending |
| CAM-05 | Phase 5 | Pending |
| CAM-06 | Phase 5 | Pending |
| CAM-07 | Phase 3 | Pending |
| CAM-08 | Phase 1 | Pending |
| CAM-09 | Phase 1 | Pending |
| ROI-01 | Phase 4 | Pending |
| ROI-02 | Phase 4 | Pending |
| ROI-03 | Phase 4 | Pending |
| ROI-04 | Phase 4 | Pending |
| ROI-05 | Phase 4 | Pending |
| RSLT-01 | Phase 4 | Pending |
| RSLT-02 | Phase 4 | Pending |
| RSLT-03 | Phase 4 | Pending |
| RSLT-04 | Phase 4 | Pending |
| RSLT-05 | Phase 4 | Pending |
| RSLT-06 | Phase 4 | Pending |
| VIS-01 | Phase 4 | Pending |
| VIS-02 | Phase 4 | Pending |
| VIS-03 | Phase 4 | Pending |
| VIS-04 | Phase 4 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| DATA-05 | Phase 2 | Pending |
| PWA-01 | Phase 1 | Pending |
| PWA-02 | Phase 1 | Pending |
| PWA-03 | Phase 1 | Pending |
| STAB-01 | Phase 1 | Pending |
| STAB-02 | Phase 1 | Pending |
| STAB-03 | Phase 1 | Pending |
| STAB-04 | Phase 1 | Pending |
| I18N-01 | Phase 5 | Pending |
| I18N-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 54 total
- Mapped to phases: 54
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-20*
*Last updated: 2026-09-20 after tech stack constraint alignment*

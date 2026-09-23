export type AppMode = 
  | 'INITIAL_GUIDE'     // 无基准图时的首次引导
  | 'CAMERA_IDLE'       // 相机待机与水平对齐
  | 'SCANNING_ANIM'     // 抓拍后的 0.8s 扫描动画态
  | 'PROCESSING'        // 配准与差分运算阶段
  | 'ROI_CONFIG'        // 拖动 4 排分割线校准阶段
  | 'RESULT_INSPECT';   // 比对结果交互页

export type ToleranceLevel = 'strict' | 'normal' | 'loose';

/** Continuous tolerance slider value 0–100 (D-11). */
export type ToleranceValue = number;

export interface ShelfCalibration {
  id: string;
  createdAt: number;
  imageDataUrl: string;
  imageDimensions: { width: number; height: number };
  splitYPercentages: [number, number, number, number]; // 4条水平线垂直百分比 (0.0 - 1.0)
  tierLabels: [string, string, string, string];
}

export interface DetectedAnomaly {
  id: string;
  rowIndex: 0 | 1 | 2 | 3;
  type: 'MISSING' | 'MOVED';
  title: string;
  expectedCount?: number;
  confidence?: number;
  displacementNote?: string;
  boundingBox: {
    x: number; // 0.0 - 1.0 (left)
    y: number; // 0.0 - 1.0 (top)
    width: number; // 0.0 - 1.0
    height: number; // 0.0 - 1.0
  };
  score: number; // 差异度评分 (0.0 - 1.0)
  dismissed: boolean;
}

export interface AuditRecord {
  id: string;
  timestamp: number;
  dateStr: string;
  timeStr: string;
  complianceRate: number; // e.g. 94
  standardCount: number; // e.g. 24
  actualCount: number; // e.g. 23
  missingCount: number;
  displacedCount: number;
  thumbnailUrl: string;
  anomalies: DetectedAnomaly[];
  tolerance: ToleranceValue | ToleranceLevel;
}

export type Language = 'cn' | 'en';

import { DetectedAnomaly } from '../../types';

export interface InspectionAnalysisResult {
  anomalies: DetectedAnomaly[];
  complianceRate: number;
  standardCount: number;
  actualCount: number;
  displacedCount: number;
  missingCount: number;
}

import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  RotateCw,
  Share2,
  Sliders,
  Sparkles,
  Touchpad,
  Volume2,
  AlertTriangle,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DetectedAnomaly, Language, ShelfCalibration, ToleranceValue } from '../types';
import { I18N } from '../lib/constants';

interface ResultInspectViewProps {
  currentCaptureUrl: string;
  baseline: ShelfCalibration;
  anomalies: DetectedAnomaly[];
  complianceRate: number;
  standardCount: number;
  actualCount: number;
  displacedCount: number;
  missingCount: number;
  tolerance: ToleranceValue;
  onToleranceChange: (tol: ToleranceValue) => void;
  onDismissAnomaly: (id: string) => void;
  onCompleteAudit: () => void;
  onBackToCamera: () => void;
  lang: Language;
}

export const ResultInspectView: React.FC<ResultInspectViewProps> = ({
  currentCaptureUrl,
  baseline,
  anomalies,
  complianceRate,
  standardCount,
  actualCount,
  displacedCount,
  missingCount,
  tolerance,
  onToleranceChange,
  onDismissAnomaly,
  onCompleteAudit,
  onBackToCamera,
  lang,
}) => {
  const t = I18N[lang];

  // State for Blink Compare (long-press to show baseline)
  const [isBlinkingBaseline, setIsBlinkingBaseline] = useState(false);
  // State for filtering by anomaly type (null = show all, 'MISSING', 'MOVED')
  const [filterType, setFilterType] = useState<'ALL' | 'MISSING' | 'MOVED'>('ALL');
  // State for toggling AR overlay bounding boxes visibility
  const [showArLayers, setShowArLayers] = useState(true);
  // Dismissed IDs for local smooth shrink animation before state update
  const [animatingDismissIds, setAnimatingDismissIds] = useState<string[]>([]);
  // Export toast
  const [showExportToast, setShowExportToast] = useState(false);

  const activeAnomalies = anomalies.filter(
    (a) =>
      !a.dismissed &&
      !animatingDismissIds.includes(a.id) &&
      (filterType === 'ALL' || a.type === filterType)
  );

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAnimatingDismissIds((prev) => [...prev, id]);
    setTimeout(() => {
      onDismissAnomaly(id);
    }, 220);
  };

  const handleComplete = () => {
    // Trigger festive celebratory confetti
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // ignore
    }
    onCompleteAudit();
  };

  const handleExport = () => {
    setShowExportToast(true);
    setTimeout(() => setShowExportToast(false), 2600);
  };

  return (
    <div className="relative w-full min-h-[100dvh] bg-[#F8FAFC] flex flex-col justify-between overflow-x-hidden select-none">
      {/* Top Header Bar */}
      <header className="sticky top-0 w-full z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToCamera}
            aria-label="Back to Camera"
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-[#0F172A] truncate">
              {t.auditResult}
            </h1>
            <p className="text-xs text-slate-500 truncate">
              {baseline.tierLabels ? baseline.tierLabels.join(' · ') : '4-Tier Planogram'}
            </p>
          </div>
        </div>

        {/* Right Compliance Status Chip */}
        <div className="flex items-center gap-1.5 bg-emerald-50 text-[#006C49] border border-emerald-200/80 rounded-full px-3 py-1 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span className="font-mono-numbers text-xs font-bold">
            {complianceRate}% {t.complianceRate}
          </span>
        </div>
      </header>

      {/* Top Floating Filter HUD Bar */}
      <div className="sticky top-[61px] z-30 px-4 py-2 bg-white/75 backdrop-blur-md border-b border-slate-100 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Filter: Missing */}
          <button
            onClick={() => setFilterType(filterType === 'MISSING' ? 'ALL' : 'MISSING')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm text-xs font-mono-numbers font-semibold active:scale-95 transition-all ${
              missingCount === 0
                ? 'bg-slate-100 text-slate-500'
                : filterType === 'MISSING'
                ? 'bg-[#EF4444] text-white ring-2 ring-red-400'
                : 'bg-red-50 text-[#EF4444] border border-red-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
            <span>
              {missingCount > 0 ? `${missingCount} ${t.missingCount}` : t.noMissing}
            </span>
          </button>

          {/* Filter: Displaced */}
          <button
            onClick={() => setFilterType(filterType === 'MOVED' ? 'ALL' : 'MOVED')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm text-xs font-mono-numbers font-semibold active:scale-95 transition-all ${
              displacedCount === 0
                ? 'bg-slate-100 text-slate-500'
                : filterType === 'MOVED'
                ? 'bg-[#F59E0B] text-white ring-2 ring-amber-400'
                : 'bg-amber-50 text-[#D97706] border border-amber-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
            <span>
              {displacedCount > 0 ? `${displacedCount} ${t.displacedCount}` : t.noDisplaced}
            </span>
          </button>
        </div>

        {/* Layer Visibility Toggle Button */}
        <button
          onClick={() => setShowArLayers(!showArLayers)}
          title="Toggle AR Boxes"
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm ${
            showArLayers
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              : 'bg-[#006C49] text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>

      {/* Main Viewport: Shelf Image & Interactive AR Canvas */}
      <div
        className="relative w-full max-w-md mx-auto aspect-[9/16] overflow-hidden bg-slate-900 cursor-pointer select-none"
        onMouseDown={() => setIsBlinkingBaseline(true)}
        onMouseUp={() => setIsBlinkingBaseline(false)}
        onMouseLeave={() => setIsBlinkingBaseline(false)}
        onTouchStart={() => setIsBlinkingBaseline(true)}
        onTouchEnd={() => setIsBlinkingBaseline(false)}
        onTouchCancel={() => setIsBlinkingBaseline(false)}
      >
        {/* Inspection Still Photo or Baseline when blinking */}
        <img
          src={isBlinkingBaseline ? baseline.imageDataUrl : currentCaptureUrl}
          alt="Shelf Inspection Display"
          className={`w-full h-full object-cover transition-all duration-150 ${
            isBlinkingBaseline ? 'filter contrast-110 brightness-105' : ''
          }`}
        />

        {/* Golden Baseline Overlay Indicator (Visible during long press) */}
        {isBlinkingBaseline && (
          <div className="absolute inset-0 bg-emerald-950/20 backdrop-blur-[1px] flex flex-col items-center justify-center pointer-events-none animate-fadeIn">
            <div className="bg-white/95 text-[#0F172A] px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
              <span className="text-sm font-bold">{t.goldenBaseline}</span>
            </div>
          </div>
        )}

        {/* AR Bounding Boxes (Hidden during Blink Compare or if layers toggled off) */}
        {!isBlinkingBaseline && showArLayers && (
          <>
            {activeAnomalies.map((item) => {
              const isMissing = item.type === 'MISSING';
              const top = item.boundingBox.y * 100;
              const left = item.boundingBox.x * 100;
              const width = item.boundingBox.width * 100;
              const height = item.boundingBox.height * 100;

              return (
                <div
                  key={item.id}
                  className={`ar-box absolute rounded-xl transition-all duration-200 ${
                    isMissing
                      ? 'border-2 border-[#EF4444] bg-[#EF4444]/15'
                      : 'border-2 border-[#F59E0B] bg-[#F59E0B]/15'
                  }`}
                  style={{
                    top: `${top}%`,
                    left: `${left}%`,
                    width: `${width}%`,
                    height: `${height}%`,
                  }}
                  onClick={(e) => handleDismiss(item.id, e)}
                >
                  {/* Floating Badge above bounding box */}
                  <div
                    className={`absolute -top-7 left-0 flex items-center gap-1 text-white px-2 py-0.5 rounded-full shadow-md font-mono-numbers text-[11px] font-bold ${
                      isMissing ? 'bg-[#EF4444]' : 'bg-[#F59E0B]'
                    }`}
                  >
                    <span>
                      {isMissing
                        ? `${t.missingCount.replace('处', '')} · ${(
                            ((item.score ?? item.confidence ?? 0) * 100)
                          ).toFixed(0)}%`
                        : `${item.displacementNote || t.displacedCount}`}
                    </span>
                    <button
                      onClick={(e) => handleDismiss(item.id, e)}
                      className="hover:opacity-80 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Inside Bounding Box Label Content */}
                  <div className="w-full h-full flex flex-col items-center justify-center p-1 pointer-events-none">
                    {isMissing ? (
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="w-5 h-5 rounded-full border border-dashed border-[#EF4444] flex items-center justify-center text-[#EF4444] animate-pulse">
                          +
                        </span>
                        <span className="font-mono-numbers text-[9px] font-bold text-[#EF4444] bg-white/90 px-1.5 py-0.2 rounded shadow-xs">
                          {item.title}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full px-1">
                        <span className="text-[#D97706] font-bold text-xs">«</span>
                        <span className="font-mono-numbers text-[9px] font-semibold text-slate-800 bg-white/90 px-1 py-0.2 rounded shadow-xs">
                          {item.title}
                        </span>
                        <span className="text-[#D97706] font-bold text-xs">»</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* Center Bottom Long-Press Hint Badge */}
        <div
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/85 backdrop-blur-md shadow-md text-[#0F172A] border border-slate-200/60 pointer-events-none transition-transform duration-150 ${
            isBlinkingBaseline ? 'scale-95 bg-emerald-50 text-emerald-800' : ''
          }`}
        >
          <Eye className="w-3.5 h-3.5 text-[#006C49]" />
          <span className="text-xs font-semibold">{t.pressHoldCompare}</span>
        </div>
      </div>

      {/* Bottom Floating Control Drawer */}
      <div className="w-full bg-white border-t border-slate-200/80 px-4 pt-3 pb-8 flex flex-col gap-3 shadow-lg z-20">
        {/* Tolerance Sensitivity Control */}
        <div className="flex flex-col gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Sliders className="w-4 h-4 text-[#006C49]" />
              <span>{t.toleranceSensitivity}</span>
            </div>
            <span className="font-mono-numbers text-xs font-bold text-[#006C49] bg-emerald-100/80 px-2 py-0.5 rounded-full">
              {t.toleranceValue.replace('{n}', String(tolerance))}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={tolerance}
              aria-label={t.toleranceSensitivity}
              onChange={(e) => onToleranceChange(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 accent-[#006C49] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#006C49] [&::-webkit-slider-thumb]:shadow-md"
            />
            <div className="grid grid-cols-3 text-[10px] text-slate-500 font-medium">
              <span className="text-left">{t.tolerancePresetStrict}</span>
              <span className="text-center">{t.tolerancePresetNormal}</span>
              <span className="text-right">{t.tolerancePresetLoose}</span>
            </div>
          </div>
        </div>

        {/* 3 Quick Shelf Telemetry Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-100 text-center">
            <span className="text-[11px] text-slate-500 font-medium">{t.standardCapacity}</span>
            <span className="font-mono-numbers text-base font-bold text-slate-900">
              {standardCount} {t.itemsUnit}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-100 text-center">
            <span className="text-[11px] text-slate-500 font-medium">{t.actualOnShelf}</span>
            <span className="font-mono-numbers text-base font-bold text-emerald-700">
              {actualCount} {t.itemsUnit}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-100 text-center">
            <span className="text-[11px] text-slate-500 font-medium">{t.displacementError}</span>
            <span className="font-mono-numbers text-base font-bold text-[#D97706]">
              {displacedCount} {t.spotsUnit}
            </span>
          </div>
        </div>

        {/* Main Action CTA Row */}
        <div className="flex items-center gap-2.5 pt-1">
          {/* Share/Export button */}
          <button
            onClick={handleExport}
            className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all flex items-center justify-center shadow-sm border border-slate-200"
            title={t.exportReport}
          >
            <Share2 className="w-5 h-5" />
          </button>

          {/* Primary Confirm & Finish Audit button */}
          <button
            onClick={handleComplete}
            className="flex-1 h-12 rounded-full bg-[#006C49] hover:bg-[#005236] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-all"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-300" />
            <span>{t.finishInspection}</span>
          </button>
        </div>
      </div>

      {/* Export Toast Notification */}
      {showExportToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-xs px-4 py-2 rounded-full shadow-xl z-50 flex items-center gap-2 border border-white/10 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>
            {lang === 'cn'
              ? `巡检报告已生成：合规度 ${complianceRate}%，已归档。`
              : `Report exported: Compliance ${complianceRate}%, saved.`}
          </span>
        </div>
      )}
    </div>
  );
};

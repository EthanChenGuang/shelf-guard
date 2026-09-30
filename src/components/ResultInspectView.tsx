import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Maximize2,
  Gauge,
  Layers,
  RotateCw,
  Share2,
  Sliders,
  Sparkles,
  Touchpad,
  Volume2,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DetectedAnomaly, Language, ShelfCalibration, ToleranceValue } from '../types';
import { I18N } from '../lib/constants';
import { frameBoxStyle } from '../lib/frameBox';
import { MIN_CONFIDENCE_CEIL, MIN_CONFIDENCE_FLOOR, meetsMinConfidence } from '../lib/vision/confidence';

/**
 * Complete class strings per anomaly type, so Tailwind sees every one of them. Outline and text
 * only: a fill or label chip would hide the very object the box points at.
 */
const TYPE_STYLES: Record<DetectedAnomaly['type'], { box: string; badge: string }> = {
  MISSING: { box: 'border-2 border-sg-danger', badge: 'text-sg-danger' },
  MOVED: { box: 'border-2 border-sg-warning', badge: 'text-sg-warning' },
  ADDED: { box: 'border-2 border-sg-scan', badge: 'text-sg-scan' },
};

/** Dark halo that keeps colored label text legible on both light and dark photo areas. */
const LABEL_HALO = { textShadow: '0 0 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.6)' };

interface ResultInspectViewProps {
  currentCaptureUrl: string;
  baseline: ShelfCalibration;
  anomalies: DetectedAnomaly[];
  complianceRate: number;
  standardCount: number;
  actualCount: number;
  displacedCount: number;
  missingCount: number;
  addedCount: number;
  tolerance: ToleranceValue;
  onToleranceChange: (tol: ToleranceValue) => void;
  minConfidence: number;
  onMinConfidenceChange: (value: number) => void;
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
  addedCount,
  tolerance,
  onToleranceChange,
  minConfidence,
  onMinConfidenceChange,
  onDismissAnomaly,
  onCompleteAudit,
  onBackToCamera,
  lang,
}) => {
  const t = I18N[lang];

  // State for Blink Compare (long-press to show baseline)
  const [isBlinkingBaseline, setIsBlinkingBaseline] = useState(false);
  // State for filtering by anomaly type ('ALL' = show all)
  const [filterType, setFilterType] = useState<'ALL' | DetectedAnomaly['type']>('ALL');
  const badgeLabels: Record<DetectedAnomaly['type'], string> = {
    MISSING: t.missingBadgeShort,
    MOVED: t.movedBadgeShort,
    ADDED: t.addedBadgeShort,
  };
  // State for toggling AR overlay bounding boxes visibility
  const [showArLayers, setShowArLayers] = useState(true);
  // Dismissed IDs for local smooth shrink animation before state update
  const [animatingDismissIds, setAnimatingDismissIds] = useState<string[]>([]);
  // Export toast
  const [showExportToast, setShowExportToast] = useState(false);
  // Full-screen inspection overlay and its zoom factor (1 = fit to screen width)
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const activeAnomalies = anomalies.filter(
    (a) =>
      !a.dismissed &&
      meetsMinConfidence(a, minConfidence) &&
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

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const renderBoxes = () =>
    !isBlinkingBaseline && showArLayers && (
      <>
        {activeAnomalies.map((item) => {
          const styles = TYPE_STYLES[item.type];
          return (
            <div
              key={item.id}
              className={`ar-box absolute rounded-xl transition-all duration-200 ${styles.box}`}
              style={{
                top: `${item.boundingBox.y * 100}%`,
                left: `${item.boundingBox.x * 100}%`,
                width: `${item.boundingBox.width * 100}%`,
                height: `${item.boundingBox.height * 100}%`,
              }}
              onClick={(e) => handleDismiss(item.id, e)}
            >
              {/* Label above the box: colored text only */}
              <div
                className={`absolute -top-5 left-0 flex items-center gap-1 whitespace-nowrap font-mono-numbers text-[11px] font-bold ${styles.badge}`}
                style={LABEL_HALO}
                title={item.title}
              >
                <span>
                  {`${badgeLabels[item.type]} · ${(
                    ((item.score ?? item.confidence ?? 0) * 100)
                  ).toFixed(0)}%`}
                </span>
                <button onClick={(e) => handleDismiss(item.id, e)} className="hover:opacity-80">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </>
    );

  const holdHandlers = {
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
    onMouseDown: () => setIsBlinkingBaseline(true),
    onMouseUp: () => setIsBlinkingBaseline(false),
    onMouseLeave: () => setIsBlinkingBaseline(false),
    onTouchStart: () => setIsBlinkingBaseline(true),
    onTouchEnd: () => setIsBlinkingBaseline(false),
    onTouchCancel: () => setIsBlinkingBaseline(false),
  };

  const ZOOM_MAX = 4;
  const changeZoom = (delta: number) =>
    setZoom((z) => Math.min(ZOOM_MAX, Math.max(1, +(z + delta).toFixed(2))));

  return (
    <div className="relative w-full min-h-[100dvh] bg-sg-surface flex flex-col justify-between overflow-x-hidden select-none">
      {/* Top Header Bar */}
      <header className="sticky top-0 w-full z-40 bg-sg-white border-b border-sg-border/80 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={onBackToCamera}
            aria-label={t.backToCamera}
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-sg-secondary hover:bg-sg-surface active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-sg-primary truncate">
              {t.auditResult}
            </h1>
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
      <div className="glass-panel sticky top-[61px] z-30 mx-4 my-2 px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Filter: Missing */}
          <button
            onClick={() => setFilterType(filterType === 'MISSING' ? 'ALL' : 'MISSING')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm text-xs font-mono-numbers font-semibold active:scale-95 transition-all ${
              missingCount === 0
                ? 'bg-sg-surface text-sg-secondary'
                : filterType === 'MISSING'
                ? 'bg-sg-danger text-white ring-2 ring-sg-danger/40'
                : 'bg-sg-danger/10 text-sg-danger border border-sg-danger/30'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sg-danger" />
            <span>
              {missingCount > 0 ? `${missingCount} ${t.missingCount}` : t.noMissing}
            </span>
          </button>

          {/* Filter: Displaced */}
          <button
            onClick={() => setFilterType(filterType === 'MOVED' ? 'ALL' : 'MOVED')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm text-xs font-mono-numbers font-semibold active:scale-95 transition-all ${
              displacedCount === 0
                ? 'bg-sg-surface text-sg-secondary'
                : filterType === 'MOVED'
                ? 'bg-sg-warning text-white ring-2 ring-sg-warning/40'
                : 'bg-sg-warning/10 text-sg-warning border border-sg-warning/30'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sg-warning" />
            <span>
              {displacedCount > 0 ? `${displacedCount} ${t.displacedCount}` : t.noDisplaced}
            </span>
          </button>

          {/* Filter: Added */}
          <button
            onClick={() => setFilterType(filterType === 'ADDED' ? 'ALL' : 'ADDED')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm text-xs font-mono-numbers font-semibold active:scale-95 transition-all ${
              addedCount === 0
                ? 'bg-sg-surface text-sg-secondary'
                : filterType === 'ADDED'
                ? 'bg-sg-scan text-white ring-2 ring-sg-scan/40'
                : 'bg-sg-scan/10 text-sg-scan border border-sg-scan/30'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sg-scan" />
            <span>
              {addedCount > 0 ? `${addedCount} ${t.addedCount}` : t.noAdded}
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
        className="relative mx-auto overflow-hidden bg-slate-900 cursor-pointer select-none [-webkit-touch-callout:none]"
        style={frameBoxStyle(baseline.imageDimensions, '72vh')}
        // Long-press is the compare gesture; the browser's image menu must not take it over.
        {...holdHandlers}
      >
        {/* Inspection Still Photo or Baseline when blinking */}
        <img
          src={isBlinkingBaseline ? baseline.imageDataUrl : currentCaptureUrl}
          alt="Shelf Inspection Display"
          draggable={false}
          className="w-full h-full object-fill pointer-events-none"
        />

        {renderBoxes()}

        {/* Expand to full screen */}
        <button
          type="button"
          aria-label={t.expandPhoto}
          title={t.expandPhoto}
          onClick={() => {
            setIsBlinkingBaseline(false);
            setZoom(1);
            setFullscreen(true);
          }}
          onMouseDown={stop}
          onMouseUp={stop}
          onTouchStart={stop}
          onTouchEnd={stop}
          className="absolute top-2 right-2 z-10 w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center active:scale-95 transition-transform"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Compare hint below the photo, so nothing covers it; shows the baseline state while held */}
      <div
        className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold transition-colors ${
          isBlinkingBaseline ? 'text-[#006C49]' : 'text-sg-secondary'
        }`}
      >
        {isBlinkingBaseline ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
        ) : (
          <Eye className="w-3.5 h-3.5 text-[#006C49]" />
        )}
        <span>{isBlinkingBaseline ? t.goldenBaseline : t.pressHoldCompare}</span>
      </div>

      {/* Bottom Floating Control Drawer */}
      <div className="w-full bg-sg-white border-t border-sg-border/80 px-4 pt-3 pb-8 flex flex-col gap-3 shadow-lg z-20">
        {/* Tolerance Sensitivity Control */}
        <div className="glass-panel flex flex-col gap-1.5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sg-primary">
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
            <div className="grid grid-cols-3 text-[10px] text-sg-secondary font-medium">
              <span className="text-left">{t.tolerancePresetStrict}</span>
              <span className="text-center">{t.tolerancePresetNormal}</span>
              <span className="text-right">{t.tolerancePresetLoose}</span>
            </div>
          </div>
        </div>

        {/* Confidence Threshold Control */}
        <div className="glass-panel flex flex-col gap-1.5 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sg-primary">
              <Gauge className="w-4 h-4 text-[#006C49]" />
              <span>{t.confidenceThreshold}</span>
            </div>
            <span className="font-mono-numbers text-xs font-bold text-[#006C49] bg-emerald-100/80 px-2 py-0.5 rounded-full">
              {`${minConfidence}%`}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            <input
              type="range"
              min={MIN_CONFIDENCE_FLOOR}
              max={MIN_CONFIDENCE_CEIL}
              step={1}
              value={minConfidence}
              aria-label={t.confidenceThreshold}
              onChange={(e) => onMinConfidenceChange(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-200 accent-[#006C49] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#006C49] [&::-webkit-slider-thumb]:shadow-md"
            />
            <span className="text-[10px] text-sg-secondary">{t.confidenceThresholdHint}</span>
          </div>
        </div>

        {/* 3 Quick Shelf Telemetry Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-sg-surface text-center">
            <span className="text-[11px] text-sg-secondary font-medium">{t.standardCapacity}</span>
            <span className="font-mono-numbers text-base font-bold text-sg-primary">
              {standardCount} {t.itemsUnit}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-sg-surface text-center">
            <span className="text-[11px] text-sg-secondary font-medium">{t.actualOnShelf}</span>
            <span className="font-mono-numbers text-base font-bold text-emerald-700">
              {actualCount} {t.itemsUnit}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-sg-surface text-center">
            <span className="text-[11px] text-sg-secondary font-medium">{t.displacementError}</span>
            <span className="font-mono-numbers text-base font-bold text-sg-warning">
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

      {/* Full-screen inspection: scroll to pan, +/- to zoom, long-press for the baseline */}
      {fullscreen && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 text-white">
            <span
              className={`flex items-center gap-1.5 text-xs font-semibold ${
                isBlinkingBaseline ? 'text-emerald-300' : 'text-white/80'
              }`}
            >
              {isBlinkingBaseline ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              {isBlinkingBaseline ? t.goldenBaseline : t.pressHoldCompare}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={t.zoomOut}
                disabled={zoom <= 1}
                onClick={() => changeZoom(-0.5)}
                className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center disabled:opacity-40"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label={t.zoomIn}
                disabled={zoom >= ZOOM_MAX}
                onClick={() => changeZoom(0.5)}
                className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center disabled:opacity-40"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label={t.closeFullscreen}
                onClick={() => {
                  setIsBlinkingBaseline(false);
                  setFullscreen(false);
                }}
                className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto [-webkit-touch-callout:none]" {...holdHandlers}>
            <div
              className="relative mx-auto"
              style={{
                aspectRatio: `${baseline.imageDimensions.width / baseline.imageDimensions.height || 9 / 16}`,
                width: `${zoom * 100}%`,
                maxWidth: zoom === 1 ? 'calc((100dvh - 4rem) * var(--ar, 0.5625))' : undefined,
                ['--ar' as string]: `${baseline.imageDimensions.width / baseline.imageDimensions.height || 9 / 16}`,
              }}
            >
              <img
                src={isBlinkingBaseline ? baseline.imageDataUrl : currentCaptureUrl}
                alt="Shelf Inspection Fullscreen"
                draggable={false}
                className="w-full h-full object-fill pointer-events-none"
              />
              {renderBoxes()}
            </div>
          </div>
        </div>
      )}

      {/* Export Toast Notification */}
      {showExportToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-xs px-4 py-2 rounded-full shadow-xl z-50 flex items-center gap-2 border border-white/10 animate-bounce">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{t.exportReportToast(complianceRate)}</span>
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  Gauge,
  Layers,
  Share2,
  Sliders,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { DetectedAnomaly, Language, ShelfCalibration, ToleranceValue } from '../types';
import { I18N } from '../lib/constants';
import { MIN_CONFIDENCE_CEIL, MIN_CONFIDENCE_FLOOR, meetsMinConfidence } from '../lib/vision/confidence';
import { InspectShelfCanvas } from './InspectShelfCanvas';
import { useBlinkCompareHold } from '../hooks/useBlinkCompareHold';
import { setInspectZoomed } from '../hooks/useLayoutViewportLock';
import { usePinchPanZoom } from '../hooks/usePinchPanZoom';
import { touchAt } from '../lib/touchAt';
import { frameBoxStyle } from '../lib/frameBox';

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

const PINCH_HINT_MS = 5000;
const PINCH_HINT_REDUCED_MS = 1600;
const HINT_FADE_MS = 400;
const HOLD_RING = 138.2;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

const PinchHintGraphic: React.FC = () => (
  <svg viewBox="0 0 88 88" className="h-24 w-24 drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)]" aria-hidden="true">
    <g className="inspect-pinch-finger-a">
      <circle cx="28" cy="32" r="12" fill="white" stroke="#0F172A" strokeWidth="3" />
      <circle cx="28" cy="32" r="4.5" fill="#0F172A" />
    </g>
    <g className="inspect-pinch-finger-b">
      <circle cx="60" cy="56" r="12" fill="white" stroke="#0F172A" strokeWidth="3" />
      <circle cx="60" cy="56" r="4.5" fill="#0F172A" />
    </g>
  </svg>
);

const HoldHintGraphic: React.FC = () => (
  <svg
    viewBox="0 0 88 88"
    className="h-24 w-24 drop-shadow-[0_2px_10px_rgba(0,0,0,0.75)]"
    data-testid="inspect-hold-graphic"
    aria-hidden="true"
  >
    <g className="inspect-hold-ripple">
      <circle cx="44" cy="44" r="20" fill="none" stroke="white" strokeWidth="2.5" />
    </g>
    <circle cx="44" cy="44" r="22" fill="none" stroke="white" strokeOpacity="0.3" strokeWidth="4" />
    <circle
      className="inspect-hold-progress"
      cx="44"
      cy="44"
      r="22"
      fill="none"
      stroke="white"
      strokeWidth="4"
      strokeDasharray={HOLD_RING}
      strokeDashoffset={HOLD_RING}
      strokeLinecap="round"
      transform="rotate(-90 44 44)"
    />
    <g className="inspect-hold-finger">
      <circle cx="44" cy="44" r="12" fill="white" stroke="#0F172A" strokeWidth="3" />
      <circle cx="44" cy="44" r="4.5" fill="#0F172A" />
    </g>
  </svg>
);

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

  const viewportRef = useRef<HTMLDivElement>(null);
  const { transform, style, touchHandlers, pointerHandlers } = usePinchPanZoom(viewportRef);
  const hold = useBlinkCompareHold();
  const isZoomed = transform.scale > 1.01;

  useLayoutEffect(() => {
    setInspectZoomed(isZoomed);
    return () => setInspectZoomed(false);
  }, [isZoomed]);
  const isBlinkingBaseline = hold.isBlinking;
  const [hintPhase, setHintPhase] = useState<'pinch' | 'hold'>('pinch');
  const [pinchHintFading, setPinchHintFading] = useState(false);
  const pinchHintGoneRef = useRef(false);
  const pinchHintHideRef = useRef<number | null>(null);
  const reducedMotion = prefersReducedMotion();

  useEffect(() => {
    const showMs = prefersReducedMotion() ? PINCH_HINT_REDUCED_MS : PINCH_HINT_MS;
    const fadeId = window.setTimeout(() => {
      if (pinchHintGoneRef.current) return;
      setPinchHintFading(true);
    }, showMs);
    const holdId = window.setTimeout(() => {
      pinchHintGoneRef.current = true;
      setHintPhase('hold');
    }, showMs + HINT_FADE_MS);
    return () => {
      window.clearTimeout(fadeId);
      window.clearTimeout(holdId);
      if (pinchHintHideRef.current != null) window.clearTimeout(pinchHintHideRef.current);
    };
  }, []);

  const dismissPinchHint = () => {
    if (pinchHintGoneRef.current) return;
    pinchHintGoneRef.current = true;
    setPinchHintFading(true);
    pinchHintHideRef.current = window.setTimeout(() => setHintPhase('hold'), HINT_FADE_MS);
  };

  // State for filtering by anomaly type ('ALL' = show all)
  const [filterType, setFilterType] = useState<'ALL' | DetectedAnomaly['type']>('ALL');
  // State for toggling AR overlay bounding boxes visibility
  const [showArLayers, setShowArLayers] = useState(true);
  // Dismissed IDs for local smooth shrink animation before state update
  const [animatingDismissIds, setAnimatingDismissIds] = useState<string[]>([]);
  // Export toast
  const [showExportToast, setShowExportToast] = useState(false);

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

  const displayImageUrl = isBlinkingBaseline ? baseline.imageDataUrl : currentCaptureUrl;

  return (
    <div
      className={`relative w-full max-w-full min-h-[100dvh] bg-sg-surface flex flex-col justify-between select-none ${
        isZoomed ? 'overflow-visible' : 'overflow-x-hidden'
      }`}
    >
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

      <div className="relative w-full">
        <div
          ref={viewportRef}
          className={`relative mx-auto cursor-pointer touch-none ${
            isZoomed ? 'z-[60] overflow-visible' : 'overflow-hidden'
          }`}
          data-testid="inspect-image-viewport"
          data-zoom-scale={transform.scale.toFixed(2)}
          data-inspect-zoomed={isZoomed ? 'true' : 'false'}
          style={{ ...frameBoxStyle(baseline.imageDimensions, '72vh'), touchAction: 'none' }}
          onMouseDown={(e) => {
            dismissPinchHint();
            hold.begin(e.clientX, e.clientY);
          }}
          onMouseMove={(e) => {
            if (e.buttons) hold.move(e.clientX, e.clientY);
          }}
          onMouseUp={() => hold.end()}
          onMouseLeave={() => hold.cancel()}
          onTouchStart={(e) => {
            dismissPinchHint();
            touchHandlers.onTouchStart(e);
            if (e.touches.length >= 2) {
              hold.cancel();
              return;
            }
            const t0 = touchAt(e.touches, 0);
            hold.begin(t0?.clientX ?? 0, t0?.clientY ?? 0);
          }}
          onTouchMove={(e) => {
            touchHandlers.onTouchMove(e);
            if (e.touches.length >= 2) {
              hold.cancel();
              return;
            }
            const t0 = touchAt(e.touches, 0);
            if (t0) hold.move(t0.clientX, t0.clientY);
          }}
          onTouchEnd={(e) => {
            touchHandlers.onTouchEnd(e);
            if (e.touches.length === 0) hold.end();
            else hold.cancel();
          }}
          onTouchCancel={(e) => {
            touchHandlers.onTouchEnd(e);
            hold.cancel();
          }}
          onPointerDown={(e) => {
            dismissPinchHint();
            pointerHandlers.onPointerDown(e);
          }}
          onPointerMove={(e) => pointerHandlers.onPointerMove(e)}
          onPointerUp={(e) => pointerHandlers.onPointerUp(e)}
          onPointerCancel={(e) => pointerHandlers.onPointerUp(e)}
        >
          <div
            data-testid="inspect-image-zoom-layer"
            className="h-full w-full will-change-transform"
            style={style}
          >
            <InspectShelfCanvas
              imageUrl={displayImageUrl}
              baseline={baseline}
              activeAnomalies={isBlinkingBaseline || !showArLayers ? [] : activeAnomalies}
              showArLayers={!isBlinkingBaseline && showArLayers}
              lang={lang}
              onDismissAnomaly={handleDismiss}
              showingBaseline={isBlinkingBaseline}
            />
          </div>
          {hintPhase === 'pinch' && (
            <div
              data-testid="inspect-pinch-hint"
              data-hint-fading={pinchHintFading ? 'true' : 'false'}
              data-reduced-motion={reducedMotion ? 'true' : 'false'}
              className="inspect-pinch-hint absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center gap-3 px-4"
              aria-hidden="true"
            >
              <PinchHintGraphic />
              <span className="inspect-hint-pill max-w-[90%] rounded-full bg-black/80 px-4 py-2 text-center text-sm font-bold leading-snug text-white shadow-lg ring-2 ring-white/90 backdrop-blur-sm">
                {t.pinchToZoom}
              </span>
            </div>
          )}
          {hintPhase === 'hold' && (
            <div
              data-testid="inspect-hold-hint"
              data-hint-phase="hold"
              data-reduced-motion={reducedMotion ? 'true' : 'false'}
              role="status"
              className="inspect-hold-hint absolute inset-0 z-[70] pointer-events-none flex flex-col items-center justify-center gap-3 px-4"
            >
              {!isBlinkingBaseline && <HoldHintGraphic />}
              <div
                className={`inspect-hint-pill flex max-w-[90%] items-center gap-2 rounded-full px-4 py-2 text-sm font-bold leading-snug shadow-lg ring-2 backdrop-blur-sm ${
                  isBlinkingBaseline
                    ? 'bg-emerald-950/85 text-emerald-50 ring-emerald-200/90'
                    : 'bg-black/80 text-white ring-white/90'
                }`}
              >
                {isBlinkingBaseline ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />
                ) : (
                  <Eye className="h-5 w-5 shrink-0 text-white" />
                )}
                <span className="text-center">
                  {isBlinkingBaseline ? t.goldenBaseline : t.pressHoldCompare}
                </span>
              </div>
            </div>
          )}
        </div>
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

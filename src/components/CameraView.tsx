import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Flashlight,
  FlashlightOff,
  Grid3X3,
  Layers,
  RotateCcw,
  ScanLine,
  SlidersVertical,
  Sparkles,
  Smartphone,
  AlertCircle,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Language, ShelfCalibration, AuditRecord } from '../types';
import { I18N } from '../lib/constants';
import { attachShelfSwipe } from '../lib/shelfSwipe';
import { nextShelfIndex, prevShelfIndex, clampShelfIndex } from '../lib/shelfIndex';
import { ShelfCarousel } from './ShelfCarousel';

interface CameraViewProps {
  baseline: ShelfCalibration;
  lang: Language;
  onLanguageToggle: () => void;
  onShutterClick: () => void;
  onOpenRoiConfig: () => void;
  onOpenHistory: () => void;
  onResetBaselinePrompt: () => void;
  lastAudit?: AuditRecord | null;
  tilt: number;
  isLevel: boolean;
  onSimulateTiltToggle?: () => void;
  isUsingDemoFeed: boolean;
  hasPersistedBaseline?: boolean;
  onToggleDemoMode: () => void;
  isTorchOn: boolean;
  onToggleTorch: () => void;
  hasTorch?: boolean;
  isShutterLocked?: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  ghostOpacity: number;
  onGhostOpacityChange: (val: number) => void;
  onInstallPwa?: () => void;
  isInstallable?: boolean;
  cameraError?: string | null;
  onRetryCamera?: () => void;
  onDismissCameraError?: () => void;
  activeShelfId?: number;
  onShelfChange?: (shelfId: number) => void;
  carouselEnabled?: boolean;
  quotaError?: boolean;
  onDismissQuotaError?: () => void;
  analysisError?: boolean;
  onDismissAnalysisError?: () => void;
  orientationDenied?: boolean;
  onRetryOrientation?: () => void;
  onDismissOrientationError?: () => void;
  hasSensor?: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  baseline,
  lang,
  onLanguageToggle,
  onShutterClick,
  onOpenRoiConfig,
  onOpenHistory,
  onResetBaselinePrompt,
  lastAudit,
  tilt,
  isLevel,
  onSimulateTiltToggle,
  isUsingDemoFeed,
  hasPersistedBaseline = false,
  onToggleDemoMode,
  isTorchOn,
  onToggleTorch,
  hasTorch = false,
  isShutterLocked = false,
  videoRef,
  ghostOpacity,
  onGhostOpacityChange,
  onInstallPwa,
  isInstallable,
  cameraError,
  onRetryCamera,
  onDismissCameraError,
  activeShelfId = 0,
  onShelfChange,
  carouselEnabled = true,
  quotaError,
  onDismissQuotaError,
  analysisError = false,
  onDismissAnalysisError,
  orientationDenied = false,
  onRetryOrientation,
  onDismissOrientationError,
  hasSensor = false,
}) => {
  const t = I18N[lang];
  const [showRoiGuides, setShowRoiGuides] = useState(true);
  const showGhost = !isUsingDemoFeed && hasPersistedBaseline && !!baseline;
  const displayTilt = orientationDenied ? 0 : tilt;
  const displayIsLevel = orientationDenied ? false : isLevel;
  const showSimulateToggle =
    !!onSimulateTiltToggle && !orientationDenied && !hasSensor;
  const reduceMotion = useReducedMotion();
  const swipeLayerRef = useRef<HTMLDivElement>(null);

  const handleShelfSelect = (shelfId: number) => {
    onShelfChange?.(clampShelfIndex(shelfId));
  };

  useEffect(() => {
    const el = swipeLayerRef.current;
    if (!el || !onShelfChange) return;

    return attachShelfSwipe(el, {
      enabled: carouselEnabled,
      onSwipeLeft: () => handleShelfSelect(nextShelfIndex(activeShelfId)),
      onSwipeRight: () => handleShelfSelect(prevShelfIndex(activeShelfId)),
    });
  }, [carouselEnabled, activeShelfId, onShelfChange]);

  const feedTransition = reduceMotion
    ? { duration: 0 }
    : { type: 'spring' as const, duration: 0.3 };

  return (
    <div
      className="relative w-full h-full min-h-[100dvh] bg-[#0F172A] overflow-hidden flex flex-col justify-between select-none"
      data-baseline-id={baseline.id}
      data-testid="camera-view"
    >
      {/* Camera feed with shelf cross-fade */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <div
          ref={swipeLayerRef}
          className="absolute inset-0 z-[5] touch-none"
          data-testid="shelf-swipe-layer"
          aria-hidden="true"
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeShelfId}
            className="absolute inset-0 w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={feedTransition}
          >
            {isUsingDemoFeed ? (
              <img
                src={baseline.imageDataUrl}
                alt="Retail Shelf Demo Stream"
                className="w-full h-full object-cover object-center pointer-events-none transition-transform duration-300 scale-105"
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover object-center pointer-events-none"
              />
            )}

            {showGhost && (
              <div
                data-testid="ghost-overlay"
                className="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen transition-opacity duration-150"
                style={{ opacity: ghostOpacity / 100 }}
              >
                <img
                  src={baseline.imageDataUrl}
                  alt="Baseline Ghost Overlay"
                  className="w-full h-full object-cover object-center filter contrast-125 brightness-110"
                />
                <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay" />
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A]/70 via-transparent to-[#0F172A]/85 pointer-events-none" />

            {showRoiGuides && (
              <div className="absolute inset-x-5 inset-y-16 pointer-events-none transition-all duration-300">
                <svg
                  className="w-full h-full text-white/75 drop-shadow-sm"
                  fill="none"
                  preserveAspectRatio="none"
                  viewBox="0 0 100 100"
                >
                  <path d="M 0 10 L 0 0 L 10 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M 90 0 L 100 0 L 100 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M 100 90 L 100 100 L 90 100" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <path d="M 10 100 L 0 100 L 0 90" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />

                  {baseline.splitYPercentages.map((percent, index) => (
                    <line
                      key={index}
                      x1="2"
                      x2="98"
                      y1={percent * 100}
                      y2={percent * 100}
                      stroke="rgba(255,255,255,0.35)"
                      strokeWidth="0.8"
                      strokeDasharray="2 3"
                    />
                  ))}
                </svg>

                <div className="absolute -top-3 left-4 bg-[#0F172A]/80 backdrop-blur-md px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-sm border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="font-mono-numbers text-[10px] text-white uppercase tracking-wider font-medium">
                    {t.roiZone}
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Center Leveling Crosshair */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          id="level-crosshair"
        >
          <div className="relative w-44 h-44 flex items-center justify-center">
            <div
              className={`absolute w-36 h-[1.5px] transition-all duration-150 ${
                orientationDenied
                  ? 'bg-slate-400/60'
                  : displayIsLevel
                    ? 'bg-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.9)]'
                    : 'bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.4)]'
              }`}
              style={{ transform: `rotate(${displayTilt}deg)` }}
            />

            <div
              className={`absolute h-36 w-[1.5px] ${
                orientationDenied
                  ? 'bg-slate-400/60'
                  : displayIsLevel
                    ? 'bg-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.9)]'
                    : 'bg-white/70'
              }`}
            />

            <div
              className={`w-12 h-12 rounded-full border flex items-center justify-center backdrop-blur-[2px] transition-colors duration-200 ${
                orientationDenied
                  ? 'border-slate-400/50 bg-slate-500/10'
                  : displayIsLevel
                    ? 'border-[#10B981] bg-[#10B981]/15 shadow-[0_0_14px_rgba(16,185,129,0.7)]'
                    : 'border-white/40 bg-black/20'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full transition-colors duration-150 ${
                  orientationDenied
                    ? 'bg-slate-400/70'
                    : displayIsLevel
                      ? 'bg-[#10B981] shadow-[0_0_8px_#10B981]'
                      : 'bg-white/80'
                }`}
              />
            </div>

            <div className={`absolute top-1 left-1 w-2 h-2 border-t border-l ${orientationDenied ? 'border-slate-400/50' : displayIsLevel ? 'border-[#10B981]' : 'border-white/40'}`} />
            <div className={`absolute top-1 right-1 w-2 h-2 border-t border-r ${orientationDenied ? 'border-slate-400/50' : displayIsLevel ? 'border-[#10B981]' : 'border-white/40'}`} />
            <div className={`absolute bottom-1 left-1 border-b border-l ${orientationDenied ? 'border-slate-400/50' : displayIsLevel ? 'border-[#10B981]' : 'border-white/40'}`} />
            <div className={`absolute bottom-1 right-1 border-b border-r ${orientationDenied ? 'border-slate-400/50' : displayIsLevel ? 'border-[#10B981]' : 'border-white/40'}`} />

            {showSimulateToggle && (
              <button
                onClick={onSimulateTiltToggle}
                className={`absolute -bottom-8 px-2.5 py-0.5 rounded-full backdrop-blur-md shadow-md flex items-center gap-1.5 transition-all pointer-events-auto cursor-pointer ${
                  displayIsLevel
                    ? 'bg-white/95 text-[#0F172A] border border-emerald-300'
                    : 'bg-[#0F172A]/85 text-amber-300 border border-amber-500/30'
                }`}
                title="Click to toggle level / tilt"
              >
                {displayIsLevel ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                    <span className="font-mono-numbers text-[10px] font-bold tracking-wide">
                      0.0° {t.level}
                    </span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-mono-numbers text-[10px] font-semibold tracking-wide">
                      {displayTilt > 0 ? `+${displayTilt}°` : `${displayTilt}°`} {t.plumb}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TOP FLOATING BAR */}
      <div className="relative z-20 px-4 pt-3 pb-1 flex items-center justify-between gap-2">
        <button
          onClick={onResetBaselinePrompt}
          className="flex items-center gap-1.5 bg-white/85 hover:bg-white backdrop-blur-xl px-3 py-1.5 rounded-full shadow-md text-[#0F172A] border border-slate-200/60 active:scale-95 transition-all"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]" />
          </span>
          <span className="text-xs font-semibold tracking-tight">{t.baselineEstablished}</span>
          <span className="font-mono-numbers text-[10px] text-slate-500 font-medium">/{t.baselineTag}</span>
        </button>

        <div className="flex items-center gap-1.5 bg-white/85 backdrop-blur-xl p-1 rounded-full shadow-md border border-slate-200/60">
          <button
            onClick={onToggleDemoMode}
            className={`px-2 h-7 rounded-full flex items-center gap-1 text-[11px] font-medium transition-colors ${
              isUsingDemoFeed
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-emerald-50 text-emerald-700 font-semibold'
            }`}
            title={isUsingDemoFeed ? t.useSampleFeed : t.useRealCamera}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isUsingDemoFeed ? 'Demo' : 'Cam'}</span>
          </button>

          {hasTorch && !isUsingDemoFeed && (
            <button
              onClick={onToggleTorch}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                isTorchOn
                  ? 'bg-[#10B981] text-white shadow-sm'
                  : 'text-[#0F172A] hover:bg-slate-100'
              }`}
              title={isTorchOn ? t.torchOff : t.torchOn}
            >
              {isTorchOn ? <Flashlight className="w-3.5 h-3.5" /> : <FlashlightOff className="w-3.5 h-3.5 text-slate-600" />}
            </button>
          )}

          <button
            onClick={onLanguageToggle}
            className="px-2 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-mono-numbers text-[11px] text-[#006C49] font-bold transition-colors"
          >
            {lang.toUpperCase()}
          </button>

          {isInstallable && onInstallPwa && (
            <button
              onClick={onInstallPwa}
              className="px-2.5 h-7 rounded-full bg-[#10B981] text-white flex items-center gap-1 text-[11px] font-semibold hover:bg-emerald-600 transition-colors shadow-sm"
              title={t.installPwa}
            >
              <Smartphone className="w-3 h-3" />
              <span>PWA</span>
            </button>
          )}
        </div>
      </div>

      {/* SHELF CAROUSEL — 5-dot indicator below top bar (D-03) */}
      {onShelfChange && (
        <div className="relative z-20 flex justify-center pb-2">
          <ShelfCarousel
            activeShelfId={activeShelfId}
            onShelfChange={handleShelfSelect}
            lang={lang}
            enabled={carouselEnabled}
          />
        </div>
      )}

      {/* RIGHT EDGE VERTICAL SLIDER (GHOST TRANSPARENCY) */}
      {showGhost && (
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center bg-white/85 backdrop-blur-xl px-2 py-3.5 rounded-full shadow-lg border border-slate-200/70">
        <div className="flex items-center justify-center mb-1 text-slate-600">
          <Layers className="w-4 h-4 text-slate-700" />
        </div>

        <div className="relative w-6 h-40 flex flex-col items-center justify-between py-1">
          <span className="font-mono-numbers text-[9px] text-slate-400 uppercase font-semibold">100</span>

          <div className="relative w-2 h-28 bg-slate-200 rounded-full overflow-hidden flex flex-col justify-end">
            <div
              className="w-full bg-[#10B981] rounded-full transition-all duration-75"
              style={{ height: `${ghostOpacity}%` }}
            />
            <input
              type="range"
              min="0"
              max="100"
              value={ghostOpacity}
              onChange={(e) => onGhostOpacityChange(Number(e.target.value))}
              aria-label={t.ghostOpacity}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </div>

          <span className="font-mono-numbers text-[9px] text-slate-400 uppercase font-semibold">0</span>
        </div>

        <div className="mt-1 text-center">
          <span className="font-mono-numbers text-[10px] text-[#006C49] font-bold block">
            {ghostOpacity}%
          </span>
          <span className="font-mono-numbers text-[8px] text-slate-400 uppercase tracking-tighter block">
            {t.ghost}
          </span>
        </div>
      </div>
      )}

      {/* BOTTOM CONTROL AREA */}
      <div className="relative z-20 pb-8 pt-3 px-6 flex flex-col items-center">
        {quotaError && (
          <div
            role="alert"
            className="mb-4 w-full max-w-sm rounded-2xl border border-amber-400/40 bg-slate-900/90 backdrop-blur-md px-4 py-3 text-white shadow-lg"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t.quotaExceededTitle}</p>
                <p className="mt-1 text-xs text-slate-300">{t.quotaExceededGuide}</p>
              </div>
              {onDismissQuotaError && (
                <button
                  type="button"
                  onClick={onDismissQuotaError}
                  aria-label={t.close}
                  className="shrink-0 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {analysisError && (
          <div
            role="alert"
            className="mb-4 w-full max-w-sm rounded-2xl border border-amber-400/40 bg-slate-900/90 backdrop-blur-md px-4 py-3 text-white shadow-lg"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t.analysisFailed}</p>
              </div>
              {onDismissAnalysisError && (
                <button
                  type="button"
                  onClick={onDismissAnalysisError}
                  aria-label={t.close}
                  className="shrink-0 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {cameraError && (
          <div
            role="alert"
            className="mb-4 w-full max-w-sm rounded-2xl border border-amber-400/40 bg-slate-900/90 backdrop-blur-md px-4 py-3 text-white shadow-lg"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t.cameraPermissionDenied}</p>
                <p className="mt-1 text-xs text-slate-300">{cameraError}</p>
                <p className="mt-2 text-xs text-slate-400">{t.cameraErrorIosGuide}</p>
                <div className="mt-3 flex items-center gap-3">
                  {onRetryCamera && (
                    <button
                      type="button"
                      onClick={onRetryCamera}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      {t.useRealCamera}
                    </button>
                  )}
                </div>
              </div>
              {onDismissCameraError && (
                <button
                  type="button"
                  onClick={onDismissCameraError}
                  aria-label={t.close}
                  className="shrink-0 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {orientationDenied && (
          <div
            role="alert"
            className="mb-4 w-full max-w-sm rounded-2xl border border-amber-400/40 bg-slate-900/90 backdrop-blur-md px-4 py-3 text-white shadow-lg"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{t.orientationPermissionDenied}</p>
                <p className="mt-2 text-xs text-slate-400">{t.orientationErrorIosGuide}</p>
                <div className="mt-3 flex items-center gap-3">
                  {onRetryOrientation && (
                    <button
                      type="button"
                      onClick={onRetryOrientation}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      {t.retryOrientation}
                    </button>
                  )}
                </div>
              </div>
              {onDismissOrientationError && (
                <button
                  type="button"
                  onClick={onDismissOrientationError}
                  aria-label={t.close}
                  className="shrink-0 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mb-4 px-3 py-1 rounded-full bg-[#0F172A]/75 backdrop-blur-md shadow-sm border border-white/10">
          <p className="text-xs text-white/95 flex items-center gap-1.5 font-medium">
            <ScanLine className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>{t.tapShutterToScan}</span>
          </p>
        </div>

        <div className="w-full flex items-center justify-between max-w-sm px-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRoiGuides(!showRoiGuides)}
              className={`w-12 h-12 rounded-full backdrop-blur-xl shadow-md flex items-center justify-center transition-all active:scale-95 border ${
                showRoiGuides
                  ? 'bg-white text-[#0F172A] border-slate-200'
                  : 'bg-white/50 text-slate-500 border-white/20'
              }`}
              title="Toggle ROI Grid"
            >
              <Grid3X3 className="w-5 h-5" />
            </button>

            <button
              onClick={onOpenRoiConfig}
              className="w-10 h-10 rounded-full bg-white/80 hover:bg-white backdrop-blur-xl shadow-md flex items-center justify-center text-[#0F172A] transition-all active:scale-95 border border-slate-200"
              title={t.tierCalibration}
            >
              <SlidersVertical className="w-4 h-4 text-slate-700" />
            </button>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute w-24 h-24 rounded-full bg-[#10B981]/25 animate-ping opacity-60 pointer-events-none" />
            <div className="absolute w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm pointer-events-none" />
            
            <button
              id="shutter-trigger"
              onClick={onShutterClick}
              aria-label={isShutterLocked ? t.shutterLocked : 'Capture & Scan Planogram'}
              aria-disabled={isShutterLocked}
              disabled={isShutterLocked}
              className={`relative w-[76px] h-[76px] rounded-full bg-white p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.35)] flex items-center justify-center transition-transform duration-150 group ${
                isShutterLocked
                  ? 'opacity-50 cursor-not-allowed pointer-events-none'
                  : 'active:scale-90 cursor-pointer'
              }`}
            >
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#0F172A] to-[#283044] flex items-center justify-center shadow-inner">
                <div className="w-6 h-6 rounded-full bg-[#10B981] flex items-center justify-center transition-transform group-hover:scale-110 shadow-[0_0_8px_rgba(16,185,129,0.8)]">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
              </div>
            </button>
          </div>

          <div className="relative flex flex-col items-center">
            <button
              onClick={onOpenHistory}
              aria-label="View Previous Shelf Audit"
              className="w-12 h-12 rounded-xl bg-white/85 backdrop-blur-xl shadow-md p-0.5 overflow-hidden active:scale-95 transition-transform border border-slate-200 hover:border-emerald-400"
            >
              <img
                src={lastAudit ? lastAudit.thumbnailUrl : baseline.imageDataUrl}
                alt="Audit Thumbnail"
                className="w-full h-full object-cover rounded-[10px]"
              />
            </button>
            <span className="absolute -bottom-2 bg-[#0F172A]/85 text-white font-mono-numbers text-[9px] px-1.5 py-0.2 rounded-full font-medium shadow-sm border border-white/10">
              {lastAudit ? lastAudit.timeStr : '14:20'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

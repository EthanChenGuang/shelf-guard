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
  AlertCircle,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Language, ShelfCalibration, AuditRecord } from '../types';
import { I18N } from '../lib/constants';
import { attachShelfSwipe } from '../lib/shelfSwipe';
import { nextShelfIndex, prevShelfIndex, clampShelfIndex } from '../lib/shelfIndex';
import { ShelfCarousel } from './ShelfCarousel';
import { InitialGuideOverlay } from './InitialGuideOverlay';

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
  showInitialGuide?: boolean;
  onDismissInitialGuide?: () => void;
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
  showInitialGuide = false,
  onDismissInitialGuide,
}) => {
  const t = I18N[lang];
  const [showRoiGuides, setShowRoiGuides] = useState(true);
  const [flashVisible, setFlashVisible] = useState(false);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showGhost =
    !showInitialGuide && !isUsingDemoFeed && hasPersistedBaseline && !!baseline;
  const showGuidePlaceholder =
    isUsingDemoFeed && (showInitialGuide || !hasPersistedBaseline);
  const showDemoFeedImage = isUsingDemoFeed && hasPersistedBaseline && !showInitialGuide;
  const displayTilt = orientationDenied ? 0 : tilt;
  const displayIsLevel = orientationDenied ? false : isLevel;
  const showSimulateToggle =
    !!onSimulateTiltToggle && !orientationDenied && !hasSensor;
  const reduceMotion = useReducedMotion();
  const swipeLayerRef = useRef<HTMLDivElement>(null);
  const cameraAvailable = !isUsingDemoFeed && !cameraError;
  const shutterBreathing =
    !showInitialGuide && !isShutterLocked && cameraAvailable && !reduceMotion;

  const handleShutterClick = () => {
    if (isShutterLocked) return;
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setFlashVisible(true);
    flashTimeoutRef.current = setTimeout(() => setFlashVisible(false), 150);
    onShutterClick();
  };

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

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
            {showGuidePlaceholder ? (
              <div
                data-testid="guide-feed-placeholder"
                className="flex h-full w-full items-center justify-center bg-sg-camera"
              >
                <Camera className="h-16 w-16 text-white/25" aria-hidden="true" />
              </div>
            ) : showDemoFeedImage ? (
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

        {flashVisible && (
          <div
            data-testid="shutter-flash-overlay"
            className="pointer-events-none absolute inset-0 z-[15] bg-white/90 transition-opacity duration-150"
          />
        )}

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

      {/* PRD 3-zone top bar (D-21, CAM-04) */}
      <div className="relative z-20 px-4 pt-3 pb-1 grid grid-cols-3 items-center gap-2">
        <div className="justify-self-start min-w-0 max-w-[11rem]">
          <button
            type="button"
            data-testid="baseline-status-pill"
            onClick={onResetBaselinePrompt}
            className="glass-panel flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-sg-primary active:scale-95 transition-all hover:bg-white/90"
          >
            {hasPersistedBaseline && (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sg-success" />
              </span>
            )}
            <span className="truncate text-[11px] font-semibold tracking-tight">
              {hasPersistedBaseline ? t.baselineEstablished : t.baselineNotSet}
            </span>
          </button>
        </div>

        <div className="justify-self-center">
          <div
            data-testid="level-micro-badge"
            className={`glass-panel flex items-center gap-1 rounded-full px-2.5 py-1 ${
              displayIsLevel ? 'bg-sg-success/10' : 'bg-sg-warning/10'
            }`}
          >
            {displayIsLevel ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-sg-success" />
                <span className="font-mono-numbers text-[10px] font-bold tracking-wide text-sg-success">
                  0.0° {t.level}
                </span>
              </>
            ) : (
              <>
                <RotateCcw className="h-3 w-3 text-sg-warning" />
                <span className="font-mono-numbers text-[10px] font-semibold tracking-wide text-sg-warning">
                  {displayTilt > 0 ? `+${displayTilt}°` : `${displayTilt}°`} {t.plumb}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="justify-self-end flex items-center gap-1 glass-panel rounded-full p-1">
          {hasTorch && !isUsingDemoFeed && (
            <button
              type="button"
              onClick={onToggleTorch}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                isTorchOn
                  ? 'bg-sg-success text-white shadow-sm'
                  : 'text-sg-primary hover:bg-sg-surface'
              }`}
              title={isTorchOn ? t.torchOff : t.torchOn}
            >
              {isTorchOn ? (
                <Flashlight className="h-3.5 w-3.5" />
              ) : (
                <FlashlightOff className="h-3.5 w-3.5 text-sg-secondary" />
              )}
            </button>
          )}

          <button
            type="button"
            data-testid="language-toggle"
            onClick={onLanguageToggle}
            className="flex h-7 items-center justify-center rounded-full bg-sg-surface px-2.5 font-mono-numbers text-[11px] font-bold text-sg-success transition-colors hover:bg-sg-border/40"
          >
            {lang === 'cn' ? '中' : 'EN'}
          </button>
        </div>
      </div>

      {/* SHELF CAROUSEL — 5-dot indicator below top bar (D-03) */}
      {onShelfChange && (
        <div className="relative z-20 flex flex-col items-stretch gap-2 pb-2">
          <div className="flex justify-center">
            <ShelfCarousel
              activeShelfId={activeShelfId}
              onShelfChange={handleShelfSelect}
              lang={lang}
              enabled={carouselEnabled}
            />
          </div>

          <div className="px-4">
            <button
              type="button"
              data-testid="demo-utility-pill"
              onClick={onToggleDemoMode}
              className="glass-panel inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-sg-primary transition-colors hover:bg-white/90 active:scale-95"
              title={isUsingDemoFeed ? t.useSampleFeed : t.useRealCamera}
            >
              <Camera className="h-3.5 w-3.5 text-sg-secondary" />
              <span>{isUsingDemoFeed ? t.useSampleFeed : t.useRealCamera}</span>
            </button>
          </div>
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

          <div className="relative flex h-[76px] w-[76px] items-center justify-center">
            {shutterBreathing && (
              <div
                data-testid="shutter-breathe-ring"
                className="pointer-events-none absolute h-[88px] w-[88px] rounded-full border-2 border-sg-success/35 animate-pulse"
              />
            )}

            <button
              id="shutter-trigger"
              type="button"
              onClick={handleShutterClick}
              aria-label={isShutterLocked ? t.shutterLocked : 'Capture & Scan Planogram'}
              aria-disabled={isShutterLocked}
              disabled={isShutterLocked}
              className={`relative flex h-[76px] w-[76px] items-center justify-center rounded-full border-[3px] border-white bg-white p-1 shadow-[0_4px_24px_rgba(0,0,0,0.35)] transition-transform duration-150 group ${
                shutterBreathing ? 'animate-shutter-breathe' : ''
              } ${
                isShutterLocked
                  ? 'cursor-not-allowed opacity-50 pointer-events-none'
                  : 'cursor-pointer active:scale-90'
              }`}
            >
              <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-sg-camera to-sg-primary shadow-inner ring-2 ring-sg-border/30">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sg-success shadow-[0_0_8px_rgba(16,185,129,0.8)] transition-transform group-hover:scale-110">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
              </div>
            </button>
          </div>

          <div className="relative flex flex-col items-center">
            <button
              type="button"
              onClick={onOpenHistory}
              aria-label="View Previous Shelf Audit"
              data-testid="last-inspection-thumbnail"
              className="h-12 w-12 overflow-hidden rounded-xl border border-sg-border bg-white/85 p-0.5 shadow-md backdrop-blur-xl transition-transform active:scale-95 hover:border-sg-success"
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

      {showInitialGuide && onDismissInitialGuide && (
        <InitialGuideOverlay
          lang={lang}
          shelfIndex={activeShelfId}
          onComplete={onDismissInitialGuide}
          onSkip={onDismissInitialGuide}
        />
      )}
    </div>
  );
};

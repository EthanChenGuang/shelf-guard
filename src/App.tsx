import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AuditRecord,
  AppMode,
  DetectedAnomaly,
  Language,
  ShelfCalibration,
  ToleranceValue,
} from './types';
import { DEFAULT_CALIBRATION, I18N } from './lib/constants';
import {
  loadSavedLanguage,
  loadSavedTolerance,
  loadSavedMinConfidence,
  saveMinConfidence,
  saveLanguage,
  saveTolerance,
} from './lib/storage';
import {
  appendAuditRecord,
  clearBaseline,
  HISTORY_CAP,
  loadActiveShelfId,
  loadAuditHistory,
  loadAuditHistoryRaw,
  loadBaselineRaw,
  runSchemaMigrationIfNeeded,
  saveActiveShelfId,
  saveBaseline,
  toViewAuditRecord,
  toViewBaseline,
} from './lib/shelfStorage';
import { createDisplayUrlRegistry } from './lib/objectUrlRegistry';
import { analyzeShelfCapture, prewarmVisionWorker } from './lib/vision';
import { computeComplianceStats } from './lib/vision/complianceStats';
import { DEFAULT_MIN_CONFIDENCE, meetsMinConfidence } from './lib/vision/confidence';
import { isCaptureLocked } from './lib/captureLock';
import { loadImageDimensions } from './lib/imageDimensions';
import {
  isFramingCompatible,
  isNativeCameraBaseline,
  isSameLens,
  normalizeNativePhoto,
} from './lib/nativeCapture';
import { useCameraStream } from './hooks/useCameraStream';
import { useDeviceOrientation } from './hooks/useDeviceOrientation';
import { usePWAInstall } from './hooks/usePWAInstall';
import { CameraView } from './components/CameraView';
import { ResultInspectView } from './components/ResultInspectView';
import { ScanningAnimationOverlay } from './components/ScanningAnimationOverlay';
import { AuditHistoryModal } from './components/AuditHistoryModal';
import { ResetBaselineModal } from './components/ResetBaselineModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { isCarouselEnabled } from './lib/carouselEnabled';

export default function App() {
  // State machine
  const [appMode, setAppMode] = useState<AppMode>('CAMERA_IDLE');

  // Multi-shelf state
  const [activeShelfId, setActiveShelfId] = useState<number>(0);
  const [quotaError, setQuotaError] = useState<boolean>(false);
  const urlRegistryRef = useRef(createDisplayUrlRegistry());

  // Baseline calibration
  const [baseline, setBaseline] = useState<ShelfCalibration>(DEFAULT_CALIBRATION);
  const [hasPersistedBaseline, setHasPersistedBaseline] = useState<boolean>(false);
  // Language
  const [lang, setLang] = useState<Language>('cn');
  // Ghost opacity (0 - 100)
  const [ghostOpacity, setGhostOpacity] = useState<number>(45);
  // Tolerance slider 0–100 (D-11)
  const [tolerance, setTolerance] = useState<ToleranceValue>(50);

  // Last captured frame
  const [capturedFrame, setCapturedFrame] = useState<string>('');

  // Analysis results
  const [anomalies, setAnomalies] = useState<DetectedAnomaly[]>([]);
  const [standardCount, setStandardCount] = useState<number>(24);
  const [minConfidence, setMinConfidence] = useState<number>(DEFAULT_MIN_CONFIDENCE);
  const stats = useMemo(
    () => computeComplianceStats(anomalies, standardCount, minConfidence),
    [anomalies, standardCount, minConfidence],
  );

  // History logs
  const [auditHistory, setAuditHistory] = useState<AuditRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);

  // Device hooks
  const {
    tilt,
    isLevel,
    hasSensor,
    orientationPermission,
    requestOrientationPermission,
    setSimulatedTilt,
  } = useDeviceOrientation();
  const [orientationDismissed, setOrientationDismissed] = useState(false);
  const captureLockRef = useRef(false);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toleranceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toleranceRequestSeqRef = useRef(0);
  const appModeRef = useRef(appMode);
  appModeRef.current = appMode;
  const workerPrewarmedRef = useRef(false);
  const [isShutterLocked, setIsShutterLocked] = useState(false);
  const [showAnalysisError, setShowAnalysisError] = useState(false);
  const [captureRejection, setCaptureRejection] = useState<'framing' | 'lens' | null>(null);

  const {
    videoRef,
    stream,
    isTorchOn,
    hasTorch,
    toggleTorch,
    hasFocus,
    focusPoint,
    setFocusPoint,
    hasMultipleCameras,
    switchCamera,
    hasMultipleLenses,
    lens,
    cycleLens,
    startCamera,
    clearCameraError,
    cameraError,
    captureFrame,
  } = useCameraStream();
  const { isInstallable, install } = usePWAInstall();

  const loadShelfData = useCallback(async (shelfId: number) => {
    const registry = urlRegistryRef.current;
    const persisted = await loadBaselineRaw(shelfId);
    let nextBaseline: ShelfCalibration;
    if (persisted) {
      const displayUrl = registry.set(`baseline:${shelfId}`, persisted.imageBlob);
      nextBaseline = toViewBaseline(persisted, displayUrl);
    } else {
      nextBaseline = DEFAULT_CALIBRATION;
    }

    const nextHistory = await loadAuditHistory(shelfId, (blob, recordId) =>
      registry.set(`history:${shelfId}:${recordId}`, blob),
    );

    setHasPersistedBaseline(persisted !== null);
    setBaseline(nextBaseline);
    setAuditHistory(nextHistory);
  }, []);

  // Load migration, active shelf, and shelf-scoped data on mount
  useEffect(() => {
    async function init() {
      const migration = await runSchemaMigrationIfNeeded();
      if (!migration.ok) {
        setQuotaError(true);
        return;
      }

      const shelfId = await loadActiveShelfId();
      setActiveShelfId(shelfId);

      const [savedLang, savedTol, savedMinConfidence] = await Promise.all([
        loadSavedLanguage(),
        loadSavedTolerance(),
        loadSavedMinConfidence(),
      ]);
      setLang(savedLang);
      setTolerance(savedTol);
      setMinConfidence(savedMinConfidence);

      await loadShelfData(shelfId);
    }
    init();
  }, [loadShelfData]);

  useEffect(() => {
    const registry = urlRegistryRef.current;
    return () => {
      registry.revokeAll();
    };
  }, []);

  // Language toggle handler
  const handleLanguageToggle = async () => {
    const nextLang: Language = lang === 'cn' ? 'en' : 'cn';
    setLang(nextLang);
    await saveLanguage(nextLang);
  };

  // Tolerance change handler — debounced 150ms full worker re-diff (D-13, VIS-03)
  const handleToleranceChange = useCallback(
    (newTol: ToleranceValue) => {
      setTolerance(newTol);
      void saveTolerance(newTol);

      if (toleranceDebounceRef.current) {
        clearTimeout(toleranceDebounceRef.current);
      }
      const seq = ++toleranceRequestSeqRef.current;
      toleranceDebounceRef.current = setTimeout(async () => {
        if (appModeRef.current !== 'RESULT_INSPECT') return;
        try {
          const result = await analyzeShelfCapture(capturedFrame, baseline, newTol);
          if (seq !== toleranceRequestSeqRef.current) return;
          if (appModeRef.current !== 'RESULT_INSPECT') return;
          setAnomalies(result.anomalies);
          setStandardCount(result.standardCount);
        } catch {
          if (seq !== toleranceRequestSeqRef.current) return;
          setShowAnalysisError(true);
          setAppMode('CAMERA_IDLE');
        }
      }, 150);
    },
    [capturedFrame, baseline],
  );

  useEffect(() => {
    return () => {
      if (toleranceDebounceRef.current) {
        clearTimeout(toleranceDebounceRef.current);
      }
    };
  }, []);

  // Pre-warm OpenCV worker on first CAMERA_IDLE with persisted baseline (RESEARCH Q1)
  useEffect(() => {
    if (appMode === 'CAMERA_IDLE' && hasPersistedBaseline && !workerPrewarmedRef.current) {
      workerPrewarmedRef.current = true;
      void prewarmVisionWorker().catch(() => {
        // Cold start covered by PROCESSING overlay if pre-warm fails
      });
    }
  }, [appMode, hasPersistedBaseline]);

  const handleShelfChange = async (newShelfId: number) => {
    urlRegistryRef.current.revokeAll();
    setActiveShelfId(newShelfId);
    const saveResult = await saveActiveShelfId(newShelfId);
    if (!saveResult.ok) {
      setQuotaError(true);
      return;
    }
    await loadShelfData(newShelfId);
  };

  // Persist a photo as this shelf's baseline and show it; false when storage is full.
  const persistBaseline = async (calibration: ShelfCalibration): Promise<boolean> => {
    const result = await saveBaseline(activeShelfId, calibration);
    if (!result.ok) {
      setQuotaError(true);
      return false;
    }
    const registry = urlRegistryRef.current;
    registry.revoke(`baseline:${activeShelfId}`);
    const blob = await fetch(calibration.imageDataUrl).then((r) => r.blob());
    const displayUrl = registry.set(`baseline:${activeShelfId}`, blob);
    setBaseline({ ...calibration, imageDataUrl: displayUrl });
    setHasPersistedBaseline(true);
    return true;
  };

  // Shutter action: snaps frame, runs 0.8s scanning beam animation, then shows inspect view
  const runCapture = async (
    acquire: () => Promise<
      { dataUrl: string; width: number; height: number; focalLength: number | null } | string
    >,
  ) => {
    if (isCaptureLocked(appMode, captureLockRef.current)) return;

    captureLockRef.current = true;
    setIsShutterLocked(true);
    setShowAnalysisError(false);
    setCaptureRejection(null);

    try {
      let frame: string;
      try {
        const acquired = await acquire();
        if (typeof acquired === 'string') {
          frame = acquired;
        } else {
          frame = acquired.dataUrl;
          if (hasPersistedBaseline && !isFramingCompatible(acquired, baseline.imageDimensions)) {
            setCaptureRejection('framing');
            return;
          }
          if (hasPersistedBaseline && !isSameLens(acquired.focalLength, baseline.lensFocalLength)) {
            setCaptureRejection('lens');
            return;
          }
        }
      } catch {
        setShowAnalysisError(true);
        return;
      }

      if (!hasPersistedBaseline) {
        const dimensions = await loadImageDimensions(frame);
        await persistBaseline({
          ...baseline,
          id: `baseline-${activeShelfId}-${Date.now()}`,
          createdAt: Date.now(),
          imageDataUrl: frame,
          imageDimensions: dimensions,
          lensFocalLength: null,
        });
        return;
      }

      setCapturedFrame(frame);
      setAppMode('SCANNING_ANIM');

      try {
        navigator.vibrate?.([30, 40, 30]);
      } catch {
        // ignore
      }

      let analysisDone = false;
      const analysisPromise = analyzeShelfCapture(frame, baseline, tolerance).then(
        (result) => {
          analysisDone = true;
          return result;
        },
      );

      scanTimerRef.current = setTimeout(() => {
        if (!analysisDone) {
          setAppMode((mode) => (mode === 'SCANNING_ANIM' ? 'PROCESSING' : mode));
        }
      }, 800);

      try {
        const result = await analysisPromise;
        setAnomalies(result.anomalies);
        setStandardCount(result.standardCount);

        if (scanTimerRef.current) {
          clearTimeout(scanTimerRef.current);
          scanTimerRef.current = null;
        }
        setAppMode('RESULT_INSPECT');
      } catch {
        if (scanTimerRef.current) {
          clearTimeout(scanTimerRef.current);
          scanTimerRef.current = null;
        }
        setShowAnalysisError(true);
        setAppMode('CAMERA_IDLE');
      }
    } finally {
      captureLockRef.current = false;
      setIsShutterLocked(false);
    }
  };

  const handleShutterClick = () => runCapture(captureFrame);
  const handleNativePhoto = (file: File) => runCapture(() => normalizeNativePhoto(file));
  const handlePickPhoto = (file: File) => runCapture(() => normalizeNativePhoto(file, baseline.imageDimensions));
  const nativeCaptureMode = hasPersistedBaseline && isNativeCameraBaseline(baseline);

  // Anomaly tap-to-dismiss handler
  const handleDismissAnomaly = (id: string) => {
    setAnomalies((prev) => prev.map((a) => (a.id === id ? { ...a, dismissed: true } : a)));
  };

  const handleMinConfidenceChange = useCallback((value: number) => {
    setMinConfidence(value);
    void saveMinConfidence(value);
  }, []);

  // Complete audit and archive to IndexedDB
  const handleCompleteAudit = async () => {
    const now = new Date();
    const newRecord: AuditRecord = {
      id: `audit-${Date.now()}`,
      timestamp: Date.now(),
      dateStr: `${now.getMonth() + 1}/${now.getDate()}`,
      timeStr: `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`,
      complianceRate: stats.complianceRate,
      standardCount,
      actualCount: stats.actualCount,
      missingCount: stats.missingCount,
      displacedCount: stats.displacedCount,
      addedCount: stats.addedCount,
      thumbnailUrl: capturedFrame,
      anomalies: anomalies.filter((a) => meetsMinConfidence(a, minConfidence)),
      tolerance,
    };

    const result = await appendAuditRecord(activeShelfId, newRecord);
    if (!result.ok) {
      setQuotaError(true);
      return;
    }

    const registry = urlRegistryRef.current;
    const raw = await loadAuditHistoryRaw(activeShelfId);
    const latest = raw[0];
    if (latest?.id === newRecord.id) {
      const thumbUrl = registry.set(
        `history:${activeShelfId}:${latest.id}`,
        latest.thumbnailBlob,
      );
      const viewRecord = toViewAuditRecord(latest, thumbUrl);
      setAuditHistory((prev) => [viewRecord, ...prev].slice(0, HISTORY_CAP));
    } else {
      setAuditHistory((prev) => [newRecord, ...prev].slice(0, HISTORY_CAP));
    }

    // Return to camera idle after showing the result
    setTimeout(() => {
      setAppMode('CAMERA_IDLE');
    }, 400);
  };

  // Reset baseline to default demo shelf
  const handleResetToDefault = async () => {
    const result = await clearBaseline(activeShelfId);
    if (!result.ok) {
      setQuotaError(true);
      return;
    }
    urlRegistryRef.current.revoke(`baseline:${activeShelfId}`);
    setHasPersistedBaseline(false);
    setBaseline(DEFAULT_CALIBRATION);
    setShowResetModal(false);
    setAppMode('CAMERA_IDLE');
  };

  // Upload custom photo as new baseline
  const handleUploadCustomBaseline = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void (async () => {
      let photo: Awaited<ReturnType<typeof normalizeNativePhoto>>;
      try {
        photo = await normalizeNativePhoto(file);
      } catch {
        setShowResetModal(false);
        setShowAnalysisError(true);
        return;
      }
      const saved = await persistBaseline({
        ...baseline,
        id: `custom-baseline-${Date.now()}`,
        imageDataUrl: photo.dataUrl,
        imageDimensions: { width: photo.width, height: photo.height },
        lensFocalLength: photo.focalLength,
        createdAt: Date.now(),
      });
      if (!saved) return;
      setShowResetModal(false);
      setAppMode('CAMERA_IDLE');
    })();
  };

  const orientationRequestedRef = useRef(false);
  useEffect(() => {
    if (!stream || orientationRequestedRef.current) return;
    orientationRequestedRef.current = true;
    setOrientationDismissed(false);
    void requestOrientationPermission();
  }, [stream, requestOrientationPermission]);

  const handleRetryOrientation = useCallback(async () => {
    setOrientationDismissed(false);
    await requestOrientationPermission();
  }, [requestOrientationPermission]);

  // Toggle simulate level for desktop debugging
  const handleSimulateTiltToggle = () => {
    if (isLevel) {
      setSimulatedTilt(8.4);
    } else {
      setSimulatedTilt(0.0);
    }
  };

  const lastAudit = auditHistory.length > 0 ? auditHistory[0] : null;

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col items-center justify-center font-sans antialiased">
      {/* 1. Camera Live View */}
      {appMode === 'CAMERA_IDLE' && (
        <CameraView
          baseline={baseline}
          lang={lang}
          activeShelfId={activeShelfId}
          onShelfChange={handleShelfChange}
          carouselEnabled={isCarouselEnabled(appMode)}
          quotaError={quotaError}
          onDismissQuotaError={() => setQuotaError(false)}
          onLanguageToggle={handleLanguageToggle}
          onShutterClick={handleShutterClick}
          isShutterLocked={isShutterLocked}
          hasTorch={hasTorch}
          onOpenHistory={() => setShowHistoryModal(true)}
          onResetBaselinePrompt={() => setShowResetModal(true)}
          lastAudit={lastAudit}
          tilt={tilt}
          isLevel={isLevel}
          onSimulateTiltToggle={handleSimulateTiltToggle}
          hasPersistedBaseline={hasPersistedBaseline}
          isTorchOn={isTorchOn}
          onToggleTorch={toggleTorch}
          hasFocus={hasFocus}
          focusPoint={focusPoint}
          onFocusPointChange={setFocusPoint}
          hasMultipleCameras={hasMultipleCameras}
          onSwitchCamera={switchCamera}
          lens={hasMultipleLenses ? lens : null}
          onCycleLens={cycleLens}
          cameraError={cameraError}
          onRetryCamera={startCamera}
          onDismissCameraError={clearCameraError}
          analysisError={showAnalysisError || captureRejection !== null}
          analysisErrorMessage={
            captureRejection === 'framing'
              ? I18N[lang].framingMismatch
              : captureRejection === 'lens'
                ? I18N[lang].lensMismatch
                : undefined
          }
          onDismissAnalysisError={() => {
            setShowAnalysisError(false);
            setCaptureRejection(null);
          }}
          nativeCaptureMode={nativeCaptureMode}
          onNativePhoto={handleNativePhoto}
          onPickPhoto={handlePickPhoto}
          orientationDenied={orientationPermission === 'denied' && !orientationDismissed}
          onRetryOrientation={handleRetryOrientation}
          onDismissOrientationError={() => setOrientationDismissed(true)}
          hasSensor={hasSensor}
          videoRef={videoRef}
          ghostOpacity={ghostOpacity}
          onGhostOpacityChange={setGhostOpacity}
          onInstallPwa={install}
          isInstallable={isInstallable}
        />
      )}

      {/* 2. Scanning 0.8s Laser Beam Transition */}
      {(appMode === 'SCANNING_ANIM' || appMode === 'PROCESSING') && (
        <ScanningAnimationOverlay
          lang={lang}
          frozenFrameUrl={capturedFrame}
          variant={appMode === 'PROCESSING' ? 'processing' : 'scanning'}
        />
      )}

      {/* 3. Inspection & Differential Analysis Result View */}
      {appMode === 'RESULT_INSPECT' && (
        <ResultInspectView
          currentCaptureUrl={capturedFrame}
          baseline={baseline}
          anomalies={anomalies}
          complianceRate={stats.complianceRate}
          standardCount={standardCount}
          actualCount={stats.actualCount}
          displacedCount={stats.displacedCount}
          missingCount={stats.missingCount}
          addedCount={stats.addedCount}
          tolerance={tolerance}
          onToleranceChange={handleToleranceChange}
          minConfidence={minConfidence}
          onMinConfidenceChange={handleMinConfidenceChange}
          onDismissAnomaly={handleDismissAnomaly}
          onCompleteAudit={handleCompleteAudit}
          onBackToCamera={() => setAppMode('CAMERA_IDLE')}
          lang={lang}
        />
      )}

      {/* Audit History Log Modal */}
      {showHistoryModal && (
        <AuditHistoryModal
          records={auditHistory}
          lang={lang}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* Reset & Recalibrate Baseline Modal */}
      {showResetModal && (
        <ResetBaselineModal
          baseline={baseline}
          lang={lang}
          onClose={() => setShowResetModal(false)}
          onResetToDefault={handleResetToDefault}
          onUploadCustomImage={handleUploadCustomBaseline}
        />
      )}

      {/* PWA Offline Connection Indicator */}
      <OfflineIndicator lang={lang} />
    </div>
  );
}

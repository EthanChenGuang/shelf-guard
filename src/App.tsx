import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AuditRecord,
  AppMode,
  DetectedAnomaly,
  Language,
  ShelfCalibration,
  ToleranceValue,
} from './types';
import { DEFAULT_CALIBRATION, DEFAULT_SHELF_IMAGE_URL, I18N } from './lib/constants';
import {
  loadSavedLanguage,
  loadSavedTolerance,
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
import { isCaptureLocked } from './lib/captureLock';
import { loadImageDimensions } from './lib/imageDimensions';
import { useCameraStream } from './hooks/useCameraStream';
import { useDeviceOrientation } from './hooks/useDeviceOrientation';
import { usePWAInstall } from './hooks/usePWAInstall';
import { CameraView } from './components/CameraView';
import { RoiSetupView } from './components/RoiSetupView';
import { ResultInspectView } from './components/ResultInspectView';
import { ScanningAnimationOverlay } from './components/ScanningAnimationOverlay';
import { AuditHistoryModal } from './components/AuditHistoryModal';
import { ResetBaselineModal } from './components/ResetBaselineModal';
import { OfflineIndicator } from './components/OfflineIndicator';

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
  const [pendingBaselineImageUrl, setPendingBaselineImageUrl] = useState<string | null>(null);
  // Language
  const [lang, setLang] = useState<Language>('cn');
  // Ghost opacity (0 - 100)
  const [ghostOpacity, setGhostOpacity] = useState<number>(45);
  // Tolerance slider 0–100 (D-11)
  const [tolerance, setTolerance] = useState<ToleranceValue>(50);

  // Last captured frame
  const [capturedFrame, setCapturedFrame] = useState<string>(DEFAULT_SHELF_IMAGE_URL);

  // Analysis results
  const [anomalies, setAnomalies] = useState<DetectedAnomaly[]>([]);
  const [complianceRate, setComplianceRate] = useState<number>(94);
  const [standardCount, setStandardCount] = useState<number>(24);
  const [actualCount, setActualCount] = useState<number>(23);
  const [displacedCount, setDisplacedCount] = useState<number>(2);
  const [missingCount, setMissingCount] = useState<number>(1);

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

  const {
    videoRef,
    isUsingDemoFeed,
    isTorchOn,
    hasTorch,
    toggleTorch,
    toggleDemoMode,
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

      const [savedLang, savedTol] = await Promise.all([
        loadSavedLanguage(),
        loadSavedTolerance(),
      ]);
      setLang(savedLang);
      setTolerance(savedTol);

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
          setComplianceRate(result.complianceRate);
          setStandardCount(result.standardCount);
          setActualCount(result.actualCount);
          setDisplacedCount(result.displacedCount);
          setMissingCount(result.missingCount);
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

  // Shutter action: snaps frame, runs 0.8s scanning beam animation, then shows inspect view
  const handleShutterClick = async () => {
    if (isCaptureLocked(appMode, captureLockRef.current)) return;

    captureLockRef.current = true;
    setIsShutterLocked(true);
    setShowAnalysisError(false);

    try {
      const frame = await captureFrame(baseline.imageDataUrl);

      if (!hasPersistedBaseline) {
        const dimensions = await loadImageDimensions(frame);
        setPendingBaselineImageUrl(frame);
        setBaseline((prev) => ({
          ...prev,
          imageDataUrl: frame,
          imageDimensions: dimensions,
        }));
        setAppMode('ROI_CONFIG');
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
        setComplianceRate(result.complianceRate);
        setStandardCount(result.standardCount);
        setActualCount(result.actualCount);
        setDisplacedCount(result.displacedCount);
        setMissingCount(result.missingCount);

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

  // Anomaly tap-to-dismiss handler
  const handleDismissAnomaly = (id: string) => {
    setAnomalies((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, dismissed: true } : a));
      const stats = computeComplianceStats(next, standardCount);
      setMissingCount(stats.missingCount);
      setDisplacedCount(stats.displacedCount);
      setActualCount(stats.actualCount);
      setComplianceRate(stats.complianceRate);
      return next;
    });
  };

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
      complianceRate,
      standardCount,
      actualCount,
      missingCount,
      displacedCount,
      thumbnailUrl: capturedFrame,
      anomalies,
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

    // Return to Camera view after brief delay
    setTimeout(() => {
      setAppMode('CAMERA_IDLE');
    }, 400);
  };

  // Save new horizontal shelf dividers in ROI setup
  const handleSaveRoiCalibration = async (
    updatedPercentages: [number, number, number, number]
  ) => {
    const imageDataUrl = pendingBaselineImageUrl ?? baseline.imageDataUrl;
    const updated: ShelfCalibration = {
      ...baseline,
      imageDataUrl,
      splitYPercentages: updatedPercentages,
      createdAt: Date.now(),
      id: pendingBaselineImageUrl
        ? `baseline-${activeShelfId}-${Date.now()}`
        : baseline.id,
    };
    const result = await saveBaseline(activeShelfId, updated);
    if (!result.ok) {
      setQuotaError(true);
      return;
    }

    if (pendingBaselineImageUrl) {
      const registry = urlRegistryRef.current;
      registry.revoke(`baseline:${activeShelfId}`);
      const blob = await fetch(pendingBaselineImageUrl).then((r) => r.blob());
      const displayUrl = registry.set(`baseline:${activeShelfId}`, blob);
      setBaseline({ ...updated, imageDataUrl: displayUrl });
      setPendingBaselineImageUrl(null);
    } else {
      setBaseline(updated);
    }

    setHasPersistedBaseline(true);
    setAppMode('CAMERA_IDLE');
  };

  const handleRetakeFirstBaseline = () => {
    setPendingBaselineImageUrl(null);
    setBaseline(DEFAULT_CALIBRATION);
    setAppMode('CAMERA_IDLE');
  };

  const handleCancelRoiConfig = () => {
    if (pendingBaselineImageUrl) {
      setPendingBaselineImageUrl(null);
      setBaseline(DEFAULT_CALIBRATION);
    }
    setAppMode('CAMERA_IDLE');
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
  };

  // Upload custom photo as new baseline
  const handleUploadCustomBaseline = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          const dimensions = await loadImageDimensions(dataUrl);
          const newCalibration: ShelfCalibration = {
            ...baseline,
            id: `custom-baseline-${Date.now()}`,
            imageDataUrl: dataUrl,
            imageDimensions: dimensions,
            createdAt: Date.now(),
          };
          const result = await saveBaseline(activeShelfId, newCalibration);
          if (!result.ok) {
            setQuotaError(true);
            return;
          }
          const registry = urlRegistryRef.current;
          registry.revoke(`baseline:${activeShelfId}`);
          const blob = await fetch(dataUrl).then((r) => r.blob());
          const displayUrl = registry.set(`baseline:${activeShelfId}`, blob);
          setHasPersistedBaseline(true);
          setBaseline({ ...newCalibration, imageDataUrl: displayUrl });
          setShowResetModal(false);
          // Prompt user to check ROI dividers
          setAppMode('ROI_CONFIG');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEnableLiveCamera = useCallback(async () => {
    if (isUsingDemoFeed) {
      const cameraOk = await startCamera();
      if (cameraOk) {
        setOrientationDismissed(false);
        await requestOrientationPermission();
      }
    } else {
      toggleDemoMode();
    }
  }, [isUsingDemoFeed, startCamera, requestOrientationPermission, toggleDemoMode]);

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
          quotaError={quotaError}
          onDismissQuotaError={() => setQuotaError(false)}
          onLanguageToggle={handleLanguageToggle}
          onShutterClick={handleShutterClick}
          isShutterLocked={isShutterLocked}
          hasTorch={hasTorch}
          onOpenRoiConfig={() => setAppMode('ROI_CONFIG')}
          onOpenHistory={() => setShowHistoryModal(true)}
          onResetBaselinePrompt={() => setShowResetModal(true)}
          lastAudit={lastAudit}
          tilt={tilt}
          isLevel={isLevel}
          onSimulateTiltToggle={handleSimulateTiltToggle}
          isUsingDemoFeed={isUsingDemoFeed}
          hasPersistedBaseline={hasPersistedBaseline}
          onToggleDemoMode={handleEnableLiveCamera}
          isTorchOn={isTorchOn}
          onToggleTorch={toggleTorch}
          cameraError={cameraError}
          onRetryCamera={startCamera}
          onDismissCameraError={clearCameraError}
          analysisError={showAnalysisError}
          onDismissAnalysisError={() => setShowAnalysisError(false)}
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

      {/* 3. ROI 4-Tier Calibration Setup View */}
      {appMode === 'ROI_CONFIG' && (
        <RoiSetupView
          baseline={baseline}
          lang={lang}
          onSave={handleSaveRoiCalibration}
          onCancel={handleCancelRoiConfig}
          isFirstBaseline={!hasPersistedBaseline && pendingBaselineImageUrl !== null}
          onRetake={handleRetakeFirstBaseline}
        />
      )}

      {/* 4. Inspection & Differential Analysis Result View */}
      {appMode === 'RESULT_INSPECT' && (
        <ResultInspectView
          currentCaptureUrl={capturedFrame}
          baseline={baseline}
          anomalies={anomalies}
          complianceRate={complianceRate}
          standardCount={standardCount}
          actualCount={actualCount}
          displacedCount={displacedCount}
          missingCount={missingCount}
          tolerance={tolerance}
          onToleranceChange={handleToleranceChange}
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
          onRecalibrate={() => {
            setShowResetModal(false);
            setAppMode('ROI_CONFIG');
          }}
          onResetToDefault={handleResetToDefault}
          onUploadCustomImage={handleUploadCustomBaseline}
        />
      )}

      {/* PWA Offline Connection Indicator */}
      <OfflineIndicator lang={lang} />
    </div>
  );
}

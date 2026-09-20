import React, { useEffect, useState } from 'react';
import {
  AuditRecord,
  AppMode,
  DetectedAnomaly,
  Language,
  ShelfCalibration,
  ToleranceLevel,
} from './types';
import { DEFAULT_CALIBRATION, DEFAULT_SHELF_IMAGE_URL, I18N } from './lib/constants';
import {
  clearBaseline,
  loadAuditHistory,
  loadBaseline,
  loadSavedLanguage,
  loadSavedTolerance,
  saveAuditRecord,
  saveBaseline,
  saveLanguage,
  saveTolerance,
} from './lib/storage';
import { analyzeShelfCapture } from './lib/vision';
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

  // Baseline calibration
  const [baseline, setBaseline] = useState<ShelfCalibration>(DEFAULT_CALIBRATION);
  // Language
  const [lang, setLang] = useState<Language>('cn');
  // Ghost opacity (0 - 100)
  const [ghostOpacity, setGhostOpacity] = useState<number>(45);
  // Tolerance level
  const [tolerance, setTolerance] = useState<ToleranceLevel>('normal');

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
  const { tilt, isLevel, setSimulatedTilt } = useDeviceOrientation();
  const {
    videoRef,
    isUsingDemoFeed,
    isTorchOn,
    toggleTorch,
    toggleDemoMode,
    captureFrame,
  } = useCameraStream();
  const { isInstallable, install } = usePWAInstall();

  // Load initial settings & baseline from IndexedDB
  useEffect(() => {
    async function init() {
      const [savedBase, savedLang, savedTol, savedHistory] = await Promise.all([
        loadBaseline(),
        loadSavedLanguage(),
        loadSavedTolerance(),
        loadAuditHistory(),
      ]);
      setBaseline(savedBase);
      setLang(savedLang);
      setTolerance(savedTol);
      setAuditHistory(savedHistory);
    }
    init();
  }, []);

  // Language toggle handler
  const handleLanguageToggle = async () => {
    const nextLang: Language = lang === 'cn' ? 'en' : 'cn';
    setLang(nextLang);
    await saveLanguage(nextLang);
  };

  // Tolerance change handler
  const handleToleranceChange = async (newTol: ToleranceLevel) => {
    setTolerance(newTol);
    await saveTolerance(newTol);
    // Recompute anomalies with new tolerance
    const result = await analyzeShelfCapture(capturedFrame, baseline, newTol);
    setAnomalies(result.anomalies);
    setComplianceRate(result.complianceRate);
    setStandardCount(result.standardCount);
    setActualCount(result.actualCount);
    setDisplacedCount(result.displacedCount);
    setMissingCount(result.missingCount);
  };

  // Shutter action: snaps frame, runs 0.8s scanning beam animation, then shows inspect view
  const handleShutterClick = async () => {
    const frame = await captureFrame(baseline.imageDataUrl);
    setCapturedFrame(frame);
    setAppMode('SCANNING_ANIM');

    try {
      navigator.vibrate?.([30, 40, 30]);
    } catch {
      // ignore
    }

    // Compute differential analysis in parallel
    const result = await analyzeShelfCapture(frame, baseline, tolerance);
    setAnomalies(result.anomalies);
    setComplianceRate(result.complianceRate);
    setStandardCount(result.standardCount);
    setActualCount(result.actualCount);
    setDisplacedCount(result.displacedCount);
    setMissingCount(result.missingCount);

    // 0.8s animation duration per PRD
    setTimeout(() => {
      setAppMode('RESULT_INSPECT');
    }, 800);
  };

  // Anomaly tap-to-dismiss handler
  const handleDismissAnomaly = (id: string) => {
    setAnomalies((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, dismissed: true } : a));
      const activeMissing = next.filter((a) => a.type === 'MISSING' && !a.dismissed).length;
      const activeDisplaced = next.filter((a) => a.type === 'MOVED' && !a.dismissed).length;
      setMissingCount(activeMissing);
      setDisplacedCount(activeDisplaced);
      setActualCount(standardCount - activeMissing);
      setComplianceRate(
        Math.max(70, Math.min(100, 100 - activeMissing * 4 - activeDisplaced * 2))
      );
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

    await saveAuditRecord(newRecord);
    setAuditHistory((prev) => [newRecord, ...prev]);

    // Return to Camera view after brief delay
    setTimeout(() => {
      setAppMode('CAMERA_IDLE');
    }, 400);
  };

  // Save new horizontal shelf dividers in ROI setup
  const handleSaveRoiCalibration = async (
    updatedPercentages: [number, number, number, number]
  ) => {
    const updated: ShelfCalibration = {
      ...baseline,
      splitYPercentages: updatedPercentages,
      createdAt: Date.now(),
    };
    setBaseline(updated);
    await saveBaseline(updated);
    setAppMode('CAMERA_IDLE');
  };

  // Reset baseline to default demo shelf
  const handleResetToDefault = async () => {
    await clearBaseline();
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
          const newCalibration: ShelfCalibration = {
            ...baseline,
            id: `custom-baseline-${Date.now()}`,
            imageDataUrl: dataUrl,
            createdAt: Date.now(),
          };
          setBaseline(newCalibration);
          await saveBaseline(newCalibration);
          setShowResetModal(false);
          // Prompt user to check ROI dividers
          setAppMode('ROI_CONFIG');
        }
      };
      reader.readAsDataURL(file);
    }
  };

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
          onLanguageToggle={handleLanguageToggle}
          onShutterClick={handleShutterClick}
          onOpenRoiConfig={() => setAppMode('ROI_CONFIG')}
          onOpenHistory={() => setShowHistoryModal(true)}
          onResetBaselinePrompt={() => setShowResetModal(true)}
          lastAudit={lastAudit}
          tilt={tilt}
          isLevel={isLevel}
          onSimulateTiltToggle={handleSimulateTiltToggle}
          isUsingDemoFeed={isUsingDemoFeed}
          onToggleDemoMode={toggleDemoMode}
          isTorchOn={isTorchOn}
          onToggleTorch={toggleTorch}
          videoRef={videoRef}
          ghostOpacity={ghostOpacity}
          onGhostOpacityChange={setGhostOpacity}
          onInstallPwa={install}
          isInstallable={isInstallable}
        />
      )}

      {/* 2. Scanning 0.8s Laser Beam Transition */}
      {appMode === 'SCANNING_ANIM' && (
        <ScanningAnimationOverlay
          lang={lang}
          frozenFrameUrl={capturedFrame}
        />
      )}

      {/* 3. ROI 4-Tier Calibration Setup View */}
      {appMode === 'ROI_CONFIG' && (
        <RoiSetupView
          baseline={baseline}
          lang={lang}
          onSave={handleSaveRoiCalibration}
          onCancel={() => setAppMode('CAMERA_IDLE')}
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
      <OfflineIndicator />
    </div>
  );
}

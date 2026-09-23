import React, { useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  LockOpen,
  RotateCcw,
  Sparkles,
  Ruler,
  ChevronsUpDown,
  Verified,
  ZoomIn,
} from 'lucide-react';
import { Language, ShelfCalibration } from '../types';
import { DEFAULT_SPLIT_Y, I18N } from '../lib/constants';

interface RoiSetupViewProps {
  baseline: ShelfCalibration;
  lang: Language;
  onSave: (updatedPercentages: [number, number, number, number]) => void;
  onCancel: () => void;
  isFirstBaseline?: boolean;
  onRetake?: () => void;
}

export const RoiSetupView: React.FC<RoiSetupViewProps> = ({
  baseline,
  lang,
  onSave,
  onCancel,
  isFirstBaseline = false,
  onRetake,
}) => {
  const t = I18N[lang];
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [splits, setSplits] = useState<[number, number, number, number]>(
    baseline.splitYPercentages || DEFAULT_SPLIT_Y
  );
  const [activeTierIndex, setActiveTierIndex] = useState<number>(1); // Default tier 2 active for magnifier demo
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isSavedAnimation, setIsSavedAnimation] = useState<boolean>(false);

  const tierTitles = [
    lang === 'cn' ? '香氛/面霜' : 'Fragrance',
    lang === 'cn' ? '护肤精华' : 'Skincare',
    lang === 'cn' ? '彩妆盘' : 'Cosmetics',
    lang === 'cn' ? '香氛蜡烛' : 'Candles',
  ];

  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    setActiveTierIndex(index);
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (index: number, e: React.PointerEvent) => {
    if (!isDragging || activeTierIndex !== index || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const yOffset = e.clientY - rect.top;
    let percent = yOffset / rect.height;

    // Constrain within bounds and relative to neighboring tiers
    const minBound = index === 0 ? 0.15 : splits[index - 1] + 0.05;
    const maxBound = index === 3 ? 0.92 : splits[index + 1] - 0.05;
    percent = Math.max(minBound, Math.min(maxBound, percent));

    const newSplits: [number, number, number, number] = [...splits];
    newSplits[index] = Math.round(percent * 1000) / 1000;
    setSplits(newSplits);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleReset = () => {
    setSplits([...DEFAULT_SPLIT_Y]);
    setActiveTierIndex(1);
  };

  const handleConfirm = () => {
    setIsSavedAnimation(true);
    onSave(splits);
    setTimeout(() => {
      setIsSavedAnimation(false);
    }, 1500);
  };

  return (
    <div className="relative w-full min-h-[100dvh] bg-[#F8FAFC] flex flex-col justify-between overflow-x-hidden select-none">
      {/* Top Header Bar */}
      <header className="sticky top-0 w-full z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onCancel}
            aria-label="Back"
            className="w-10 h-10 -ml-1 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-bold text-[#0F172A] leading-tight">
              {t.tierCalibration}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {isFirstBaseline ? t.firstBaselineHint : t.tierSubtitle}
            </p>
          </div>
        </div>

        <div className="bg-emerald-50 text-[#006C49] border border-emerald-200/80 rounded-full px-3 py-1 flex items-center gap-1.5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span className="font-mono-numbers text-xs font-bold">{t.tiersIdentified}</span>
        </div>
      </header>

      {/* Main Calibration Canvas Stage */}
      <div className="relative flex-1 w-full px-4 py-3 flex flex-col items-center justify-center">
        <div
          ref={stageRef}
          className="relative w-full max-w-md aspect-[9/16] max-h-[66vh] rounded-2xl overflow-hidden shadow-lg bg-[#0F172A] border border-slate-200/80 touch-none"
        >
          {/* Baseline Image */}
          <img
            src={baseline.imageDataUrl}
            alt="Calibration Still Shelf Frame"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          />

          {/* Sub-millimeter Optical Calibration Grid */}
          <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Top HUD Badges */}
          <div className="absolute top-3 left-3 pointer-events-none z-20 flex items-center gap-1.5 bg-[#0F172A]/85 backdrop-blur-md text-white px-2.5 py-1 rounded-full shadow-sm border border-white/10">
            <span className="font-mono-numbers text-[10px] tracking-wider font-semibold">
              STILL CAPTURE: #0829-HD
            </span>
          </div>

          <div className="absolute top-3 right-3 pointer-events-none z-20 flex items-center gap-1.5 bg-[#0F172A]/85 backdrop-blur-md text-[#10B981] px-2.5 py-1 rounded-full shadow-sm border border-white/10">
            <span className="font-mono-numbers text-[10px] font-bold">
              {t.level} ±0.2°
            </span>
          </div>

          {/* 4 Interactive Tier Dividers */}
          {splits.map((splitPercent, idx) => {
            const isActive = activeTierIndex === idx;
            const topPercent = splitPercent * 100;

            return (
              <div
                key={idx}
                onPointerDown={(e) => handlePointerDown(idx, e)}
                onPointerMove={(e) => handlePointerMove(idx, e)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`absolute w-full left-0 flex items-center -translate-y-1/2 cursor-ns-resize transition-all ${
                  isActive ? 'z-30' : 'z-20'
                }`}
                style={{ top: `${topPercent}%` }}
              >
                {/* Horizontal Guide Beam */}
                <div
                  className={`absolute inset-x-0 transition-all ${
                    isActive
                      ? 'h-1 bg-[#10B981] shadow-[0_0_12px_rgba(16,185,129,0.9)]'
                      : 'h-0.5 bg-[#4EDEA3] opacity-80 border-dashed shadow-[0_0_6px_rgba(78,222,163,0.7)]'
                  }`}
                />

                {/* Left Tier Indicator Pill */}
                <div
                  className={`relative z-20 left-2 rounded-full flex items-center gap-1.5 shadow-md transition-all ${
                    isActive
                      ? 'bg-[#006C49] text-white pl-2 pr-3 py-1 scale-105 shadow-lg'
                      : 'bg-[#0F172A]/90 text-white pl-1.5 pr-2.5 py-0.5'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                      isActive ? 'bg-white text-[#006C49]' : 'bg-[#4EDEA3] text-[#0F172A]'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <span className="font-mono-numbers text-[11px] font-bold">
                    Tier {idx + 1}
                  </span>
                  {isActive && <LockOpen className="w-3 h-3 text-emerald-300" />}
                </div>

                {/* 2X Precision Magnifier above active tier divider */}
                {isActive && (
                  <div className="relative mx-auto flex flex-col items-center pointer-events-none z-40">
                    <div className="absolute -top-[94px] w-20 h-20 rounded-full overflow-hidden shadow-2xl bg-[#0F172A] border-2 border-[#10B981] flex items-center justify-center">
                      {/* Magnified Optical Viewport Slice */}
                      <div
                        className="relative w-40 h-40 scale-[2.0] pointer-events-none opacity-95 filter brightness-110 contrast-125 transition-transform"
                        style={{
                          transform: `translateY(-${(splitPercent - 0.45) * 80}px) scale(2.0)`,
                        }}
                      >
                        <img
                          src={baseline.imageDataUrl}
                          alt="Magnified focal preview"
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Crosshair Overlay inside lens */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-[1.5px] bg-[#10B981] shadow-[0_0_4px_#10B981]" />
                        <div className="absolute h-full w-[1.5px] bg-[#10B981] shadow-[0_0_4px_#10B981]" />
                        <div className="absolute w-2 h-2 rounded-full bg-white shadow-sm" />
                      </div>

                      {/* Lens Tags */}
                      <div className="absolute top-1.5 px-1.5 py-0.5 rounded-full bg-[#0F172A]/90 text-emerald-300 font-mono-numbers text-[8px] font-bold tracking-tight">
                        2.0X ZOOM
                      </div>
                      <div className="absolute bottom-1 px-1.5 py-0.5 rounded-full bg-[#10B981]/90 text-white font-mono-numbers text-[8px] font-semibold">
                        {t.edgeSnapped}
                      </div>
                    </div>

                    {/* Downward pointer notch to beam */}
                    <div className="absolute -top-3 w-0 h-0 border-x-4 border-x-transparent border-t-[6px] border-t-[#10B981]" />
                  </div>
                )}

                {/* Right Handle with Coordinate Value */}
                <div
                  className={`relative z-20 right-2 rounded-full flex items-center gap-1 shadow-md transition-all ${
                    isActive
                      ? 'bg-[#006C49] text-white px-2.5 py-1 scale-105 shadow-lg'
                      : 'bg-[#4EDEA3] text-[#0F172A] px-2 py-0.5'
                  }`}
                >
                  <span className="font-mono-numbers text-[10px] font-semibold">
                    Y: {(splitPercent * 100).toFixed(1)}%
                  </span>
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}

          {/* Active tier status HUD pill at bottom of stage */}
          <div className="absolute bottom-3 left-3 right-3 pointer-events-none z-20 flex items-center justify-between bg-[#0F172A]/85 backdrop-blur-md px-3 py-1.5 rounded-xl text-white border border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300">
                {lang === 'cn' ? '当前调整：' : 'Selected: '}
                <strong className="text-white font-semibold">
                  第 {activeTierIndex + 1} 层 (Tier {activeTierIndex + 1})
                </strong>
              </span>
            </div>
            <span className="font-mono-numbers text-[10px] text-[#4EDEA3] uppercase tracking-wider font-semibold">
              {lang === 'cn' ? '微调模式激活' : 'Fine-Tune Active'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Floating Control Drawer */}
      <div className="w-full bg-white border-t border-slate-200/80 px-4 pt-3 pb-8 flex flex-col gap-3 shadow-lg">
        {/* Microcopy Pill */}
        <div className="w-full flex items-center justify-center gap-1.5 text-slate-600 text-center">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs">{t.dragHint}</span>
        </div>

        {/* 4 Tiers Quick Summary Cards */}
        <div className="grid grid-cols-4 gap-2 w-full bg-slate-100 p-1.5 rounded-xl">
          {splits.map((p, i) => {
            const isSelected = activeTierIndex === i;
            return (
              <button
                key={i}
                onClick={() => setActiveTierIndex(i)}
                className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                  isSelected
                    ? 'bg-[#006C49] text-white shadow-sm'
                    : 'bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`block text-[10px] font-medium truncate ${
                    isSelected ? 'text-emerald-100' : 'text-slate-500'
                  }`}
                >
                  T{i + 1} {tierTitles[i]}
                </span>
                <span
                  className={`font-mono-numbers text-xs font-bold ${
                    isSelected ? 'text-white' : 'text-[#006C49]'
                  }`}
                >
                  {(p * 100).toFixed(1)}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons Row */}
        <div className="w-full flex items-center gap-3 pt-1">
          {/* Reset Button */}
          <button
            onClick={handleReset}
            className="h-12 px-4 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center gap-1.5 flex-shrink-0 font-semibold text-sm border border-slate-200"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.resetSplits}</span>
          </button>

          {isFirstBaseline && onRetake && (
            <button
              onClick={onRetake}
              className="h-12 px-4 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center gap-1.5 flex-shrink-0 font-semibold text-sm border border-slate-200"
            >
              <span>{t.retake}</span>
            </button>
          )}

          {/* Confirm & Save Calibration Button */}
          <button
            onClick={handleConfirm}
            className={`flex-1 h-12 px-5 rounded-full text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
              isSavedAnimation
                ? 'bg-[#10B981]'
                : 'bg-[#0F172A] hover:bg-[#1E293B]'
            }`}
          >
            <Verified className="w-5 h-5 text-emerald-400" />
            <span>
              {isSavedAnimation
                ? lang === 'cn'
                  ? '标定已保存 (4 Tiers Locked)'
                  : 'Calibration Saved!'
                : t.saveCalibration}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

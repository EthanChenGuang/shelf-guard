import React from 'react';
import { AlertCircle, Camera, Check, RefreshCw, SlidersVertical, X } from 'lucide-react';
import { Language, ShelfCalibration } from '../types';
import { I18N } from '../lib/constants';

interface ResetBaselineModalProps {
  baseline: ShelfCalibration;
  lang: Language;
  onClose: () => void;
  onRecalibrate: () => void;
  onResetToDefault: () => void;
  onUploadCustomImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const ResetBaselineModal: React.FC<ResetBaselineModalProps> = ({
  baseline,
  lang,
  onClose,
  onRecalibrate,
  onResetToDefault,
  onUploadCustomImage,
}) => {
  const t = I18N[lang];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[#006C49]">
              <Camera className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-[#0F172A] text-base">{t.resetBaseline}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thumbnail Preview of current baseline */}
        <div className="relative w-full h-36 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
          <img
            src={baseline.imageDataUrl}
            alt="Current baseline"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2.5">
            <span className="text-white text-xs font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              {t.baselineEstablished} (4 Tiers)
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          {lang === 'cn'
            ? '当前基准图用于每次巡检时的幽灵覆层透视配准与四排横梁差分比对。您可以调整分段标定，或上传新拍摄的货架标准照。'
            : 'The current baseline is used for ghost alignment and 4-tier differential inspection. You can recalibrate tiers or upload a new photo.'}
        </p>

        {/* Action Options */}
        <div className="space-y-2 pt-1">
          {/* Recalibrate horizontal dividers */}
          <button
            onClick={onRecalibrate}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0F172A] font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <SlidersVertical className="w-4 h-4 text-[#006C49]" />
            <span>{t.tierCalibration}</span>
          </button>

          {/* Upload new photo as baseline */}
          <label className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 hover:border-[#10B981] hover:bg-emerald-50/50 text-[#0F172A] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer">
            <Camera className="w-4 h-4 text-[#006C49]" />
            <span>{lang === 'cn' ? '上传/拍照替换基准图' : 'Upload / Snap New Baseline'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onUploadCustomImage}
            />
          </label>

          {/* Reset to standard preset */}
          <button
            onClick={onResetToDefault}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-medium text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            <span>{lang === 'cn' ? '清除基准图并重新拍摄' : 'Clear baseline and recapture'}</span>
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

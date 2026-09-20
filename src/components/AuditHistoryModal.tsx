import React from 'react';
import { ArrowLeft, Calendar, CheckCircle2, Clock, Trash2, X } from 'lucide-react';
import { AuditRecord, Language } from '../types';
import { I18N } from '../lib/constants';

interface AuditHistoryModalProps {
  records: AuditRecord[];
  lang: Language;
  onClose: () => void;
  onSelectRecord?: (record: AuditRecord) => void;
}

export const AuditHistoryModal: React.FC<AuditHistoryModalProps> = ({
  records,
  lang,
  onClose,
}) => {
  const t = I18N[lang];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#006C49]" />
            <h2 className="text-base font-bold text-[#0F172A]">{t.auditHistory}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of records */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {records.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="text-sm">{t.noHistory}</p>
            </div>
          ) : (
            records.map((rec) => (
              <div
                key={rec.id}
                className="p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-[#10B981] transition-all flex items-center gap-3 shadow-xs"
              >
                {/* Thumbnail */}
                <div className="w-14 h-20 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                  <img
                    src={rec.thumbnailUrl}
                    alt="Audit capture"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono-numbers text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {rec.dateStr} {rec.timeStr}
                    </span>
                    <span
                      className={`font-mono-numbers text-xs font-bold px-2 py-0.5 rounded-full ${
                        rec.complianceRate >= 90
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {rec.complianceRate}% {t.complianceRate}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
                    <div className="bg-slate-50 rounded p-1">
                      <span className="text-[10px] text-slate-500 block">{t.actualOnShelf}</span>
                      <span className="font-mono-numbers text-xs font-bold text-slate-800">
                        {rec.actualCount}
                      </span>
                    </div>
                    <div className="bg-red-50 rounded p-1">
                      <span className="text-[10px] text-red-500 block">{t.missingCount}</span>
                      <span className="font-mono-numbers text-xs font-bold text-[#EF4444]">
                        {rec.missingCount}
                      </span>
                    </div>
                    <div className="bg-amber-50 rounded p-1">
                      <span className="text-[10px] text-amber-600 block">{t.displacedCount}</span>
                      <span className="font-mono-numbers text-xs font-bold text-[#D97706]">
                        {rec.displacedCount}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 text-right">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#0F172A] text-white font-semibold text-sm hover:bg-slate-800 transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};

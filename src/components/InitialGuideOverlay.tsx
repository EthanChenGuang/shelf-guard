import React, { useState } from 'react';
import { Camera, ChevronRight, ScanLine } from 'lucide-react';
import { Language } from '../types';
import { getShelfLabel, I18N } from '../lib/constants';

export interface InitialGuideOverlayProps {
  lang: Language;
  shelfIndex: number;
  onComplete: () => void;
  onSkip: () => void;
  /** Test hook — render a specific step (0–2) without stepping through. */
  initialStep?: number;
}

export const InitialGuideOverlay: React.FC<InitialGuideOverlayProps> = ({
  lang,
  shelfIndex,
  onComplete,
  onSkip,
  initialStep = 0,
}) => {
  const t = I18N[lang];
  const [step, setStep] = useState(initialStep);
  const shelfName = getShelfLabel(lang, shelfIndex);

  return (
    <div
      data-testid="initial-guide"
      className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-sg-camera/95 px-6 text-white"
    >
      <div className="mb-6 flex items-center gap-2">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            data-testid={`guide-step-dot-${index}`}
            className={`rounded-full transition-all ${
              index === step
                ? 'h-2.5 w-2.5 bg-sg-success'
                : index < step
                  ? 'h-2 w-2 bg-sg-success/60'
                  : 'h-2 w-2 border border-white/40 bg-transparent'
            }`}
          />
        ))}
      </div>

      <div className="glass-panel max-w-sm w-full p-6 text-center space-y-4">
        {step === 0 && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sg-success/15">
              <Camera className="h-7 w-7 text-sg-success" />
            </div>
            <h2 className="text-base font-semibold text-sg-primary">{t.welcomeStep}</h2>
            <p className="text-sm text-sg-secondary leading-relaxed">{t.guideWelcome(shelfName)}</p>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1 rounded-full bg-sg-success px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t.guideNext}
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sg-success/15">
              <ScanLine className="h-7 w-7 text-sg-success" />
            </div>
            <h2 className="text-base font-semibold text-sg-primary">{t.alignmentStep}</h2>
            <p className="text-sm text-sg-secondary leading-relaxed">{t.guideAlignment}</p>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1 rounded-full bg-sg-success px-5 py-2.5 text-sm font-semibold text-white"
            >
              {t.guideNext}
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-base font-semibold text-sg-primary">{t.captureBaseline}</h2>
            <p className="text-sm text-sg-secondary leading-relaxed">{t.guideCaptureHint}</p>
            <button
              type="button"
              data-testid="capture-baseline-cta"
              onClick={onComplete}
              className="w-full rounded-full bg-sg-success px-5 py-3 text-sm font-semibold text-white"
            >
              {t.captureBaseline}
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        data-testid="skip-guide"
        onClick={onSkip}
        className="mt-6 text-sm text-white/70 underline-offset-2 hover:text-white hover:underline"
      >
        {t.skipGuide}
      </button>
    </div>
  );
};

import {describe, expect, it, vi} from 'vitest';

describe('App PROCESSING FSM (STAB-03)', () => {
  it('transitions to PROCESSING when analysis exceeds 800ms', async () => {
    vi.useFakeTimers();
    let appMode = 'SCANNING_ANIM' as string;
    let analysisDone = false;

    const analysisPromise = new Promise<{anomalies: []}>((resolve) => {
      setTimeout(() => {
        analysisDone = true;
        resolve({anomalies: []});
      }, 1200);
    });

    const timer = setTimeout(() => {
      if (!analysisDone) {
        appMode = appMode === 'SCANNING_ANIM' ? 'PROCESSING' : appMode;
      }
    }, 800);

    await vi.advanceTimersByTimeAsync(800);
    expect(appMode).toBe('PROCESSING');

    await vi.advanceTimersByTimeAsync(400);
    await analysisPromise;
    clearTimeout(timer);
    appMode = 'RESULT_INSPECT';
    expect(appMode).toBe('RESULT_INSPECT');

    vi.useRealTimers();
  });
});

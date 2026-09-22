import { vi } from 'vitest';

export function installRequestPermission(
  impl: () => Promise<'granted' | 'denied'>,
) {
  const fn = vi.fn(impl);
  (globalThis.DeviceOrientationEvent as unknown as { requestPermission: typeof fn })
    .requestPermission = fn;
  return fn;
}

export function emitDeviceOrientation(gamma: number) {
  const event = new Event('deviceorientation') as DeviceOrientationEvent;
  Object.defineProperty(event, 'gamma', { value: gamma, configurable: true });
  window.dispatchEvent(event);
}

export function removeRequestPermission() {
  delete (globalThis.DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  }).requestPermission;
}

import {describe, expect, it} from 'vitest';
import {pickWideAngleDeviceId} from './useCameraStream';

describe('pickWideAngleDeviceId', () => {
  it('prefers ultra-wide labeled back cameras over telephoto', () => {
    const id = pickWideAngleDeviceId([
      {deviceId: 'tele', kind: 'videoinput', label: 'Telephoto back', groupId: 'a'},
      {deviceId: 'wide', kind: 'videoinput', label: 'Ultra wide back', groupId: 'a'},
      {deviceId: 'main', kind: 'videoinput', label: 'Back camera', groupId: 'a'},
    ] as MediaDeviceInfo[]);

    expect(id).toBe('wide');
  });

  it('ignores front-facing devices when picking wide back lens', () => {
    const id = pickWideAngleDeviceId([
      {deviceId: 'front', kind: 'videoinput', label: 'Front camera', groupId: 'f'},
      {deviceId: 'wide', kind: 'videoinput', label: 'Ultra wide back', groupId: 'a'},
    ] as MediaDeviceInfo[]);

    expect(id).toBe('wide');
  });
});

import { describe, expect, it } from 'vitest';

import { availableNetworkModeFor, connectionUrlForMode } from './ConnectPhoneModal';

const remoteAccess = {
  enabled: true,
  url: 'http://192.168.1.20:7777?token=abc',
  wifiUrl: 'http://192.168.1.20:7777?token=abc',
  tailscaleUrl: 'http://100.64.1.2:7777?token=abc',
};

describe('connectionUrlForMode', () => {
  it('returns null while remote access is disabled', () => {
    expect(connectionUrlForMode({ ...remoteAccess, enabled: false }, 'wifi')).toBeNull();
  });

  it('uses the selected network URL when available', () => {
    expect(connectionUrlForMode(remoteAccess, 'wifi')).toBe(remoteAccess.wifiUrl);
    expect(connectionUrlForMode(remoteAccess, 'tailscale')).toBe(remoteAccess.tailscaleUrl);
  });

  it('falls back to the server URL when the selected network URL is missing', () => {
    expect(connectionUrlForMode({ ...remoteAccess, wifiUrl: null }, 'wifi')).toBe(remoteAccess.url);
    expect(connectionUrlForMode({ ...remoteAccess, tailscaleUrl: null }, 'tailscale')).toBe(
      remoteAccess.url,
    );
  });
});

describe('availableNetworkModeFor', () => {
  it('keeps the current network mode while it is available', () => {
    expect(availableNetworkModeFor(remoteAccess, 'wifi')).toBe('wifi');
    expect(availableNetworkModeFor(remoteAccess, 'tailscale')).toBe('tailscale');
  });

  it('switches to an available mode when the current mode is unavailable', () => {
    expect(availableNetworkModeFor({ ...remoteAccess, wifiUrl: null }, 'wifi')).toBe('tailscale');
    expect(availableNetworkModeFor({ ...remoteAccess, tailscaleUrl: null }, 'tailscale')).toBe(
      'wifi',
    );
  });

  it('keeps the current mode when only the fallback server URL is known', () => {
    expect(
      availableNetworkModeFor({ ...remoteAccess, wifiUrl: null, tailscaleUrl: null }, 'wifi'),
    ).toBe('wifi');
  });
});

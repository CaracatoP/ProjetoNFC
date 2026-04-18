import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/appConfig.js', () => ({
  appConfig: {
    apiBaseUrl: 'https://api.example.com/api',
  },
}));

import { resolveMediaUrl } from './formatters.js';

describe('resolveMediaUrl', () => {
  it('keeps external CDN URLs untouched', () => {
    expect(resolveMediaUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
  });

  it('rewrites localhost upload URLs to the configured API origin', () => {
    expect(resolveMediaUrl('http://localhost:4000/uploads/2026-04/logo.png')).toBe(
      'https://api.example.com/uploads/2026-04/logo.png',
    );
  });

  it('expands relative upload URLs with the configured API origin', () => {
    expect(resolveMediaUrl('/uploads/2026-04/banner.png')).toBe(
      'https://api.example.com/uploads/2026-04/banner.png',
    );
  });
});

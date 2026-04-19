import { describe, expect, it } from 'vitest';
import { resolveMediaUrl } from './formatters.js';

describe('resolveMediaUrl', () => {
  it('keeps external CDN URLs untouched', () => {
    expect(resolveMediaUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
  });

  it('keeps cloudinary URLs untouched', () => {
    expect(
      resolveMediaUrl('https://res.cloudinary.com/demo/image/upload/v1/nfc-saas/default/banner.png'),
    ).toBe('https://res.cloudinary.com/demo/image/upload/v1/nfc-saas/default/banner.png');
  });

  it('returns relative paths as-is when explicitly provided', () => {
    expect(resolveMediaUrl('/assets/logo-local.svg')).toBe('/assets/logo-local.svg');
  });
});

import { describe, expect, it } from 'vitest';
import { resolveMediaUrl } from './formatters.js';

describe('resolveMediaUrl', () => {
  it('keeps external CDN URLs untouched', () => {
    expect(resolveMediaUrl('https://cdn.example.com/logo.png')).toBe('https://cdn.example.com/logo.png');
  });

  it('keeps cloudinary URLs untouched', () => {
    expect(
      resolveMediaUrl('https://res.cloudinary.com/demo/image/upload/v1/taplink/default/banner.png'),
    ).toBe('https://res.cloudinary.com/demo/image/upload/v1/taplink/default/banner.png');
  });

  it('adds safe Cloudinary transformations only when optimization options are provided', () => {
    expect(
      resolveMediaUrl('https://res.cloudinary.com/demo/image/upload/v1/taplink/default/banner.png', {
        width: 960,
        height: 540,
        fit: 'fill',
      }),
    ).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,dpr_auto,c_fill,w_960,h_540/v1/taplink/default/banner.png',
    );
  });

  it('returns relative paths as-is when explicitly provided', () => {
    expect(resolveMediaUrl('/assets/logo-local.svg')).toBe('/assets/logo-local.svg');
  });

  it('keeps non-Cloudinary absolute URLs intact even when image options are provided', () => {
    expect(resolveMediaUrl('https://cdn.example.com/logo.png', { width: 320 })).toBe(
      'https://cdn.example.com/logo.png',
    );
  });
});

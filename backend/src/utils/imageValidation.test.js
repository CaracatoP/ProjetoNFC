import { describe, expect, it } from 'vitest';
import { getAcceptedImageMimeTypes, hasValidImageSignature } from './imageValidation.js';

const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('imageValidation', () => {
  it('accepts files when the MIME type matches the real image signature', () => {
    expect(
      hasValidImageSignature({
        mimetype: 'image/png',
        buffer: Buffer.concat([pngHeader, Buffer.from('test')]),
      }),
    ).toBe(true);
  });

  it('rejects spoofed image uploads with invalid binary signatures', () => {
    expect(
      hasValidImageSignature({
        mimetype: 'image/png',
        buffer: Buffer.from('fake-image-content'),
      }),
    ).toBe(false);
  });

  it('keeps the accepted upload MIME list explicit', () => {
    expect(getAcceptedImageMimeTypes()).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ]);
  });
});

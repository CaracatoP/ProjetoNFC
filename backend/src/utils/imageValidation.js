const IMAGE_SIGNATURES = {
  'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) =>
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a,
  'image/webp': (buffer) =>
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP',
  'image/gif': (buffer) => {
    const signature = buffer.toString('ascii', 0, 6);
    return signature === 'GIF87a' || signature === 'GIF89a';
  },
  'image/svg+xml': (buffer) => {
    const preview = buffer.toString('utf8', 0, Math.min(buffer.length, 1024)).trim().toLowerCase();
    return preview.includes('<svg') || preview.startsWith('<?xml');
  },
};

export function hasValidImageSignature(file) {
  const validator = IMAGE_SIGNATURES[file?.mimetype];

  if (!validator || !file?.buffer?.length) {
    return false;
  }

  return validator(file.buffer);
}

export function getAcceptedImageMimeTypes() {
  return Object.keys(IMAGE_SIGNATURES);
}

import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, hasPaymentCredentialsEncryptionKey } from './secretCrypto.js';

describe('secretCrypto', () => {
  const validKey = '12345678901234567890123456789012';

  it('encrypts and decrypts payment secrets with AES-256-GCM', () => {
    const encrypted = encryptSecret('APP_USR-test-token', validKey);

    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain('APP_USR-test-token');
    expect(decryptSecret(encrypted, validKey)).toBe('APP_USR-test-token');
  });

  it('returns empty strings for empty values', () => {
    expect(encryptSecret('', validKey)).toBe('');
    expect(decryptSecret('', validKey)).toBe('');
  });

  it('rejects invalid encryption keys', () => {
    expect(hasPaymentCredentialsEncryptionKey('short-key')).toBe(false);
    expect(() => encryptSecret('secret', 'short-key')).toThrow(/32 bytes/i);
  });
});

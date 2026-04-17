import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './apiClient.js';

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves json content type when custom headers are provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });

    await apiRequest('http://localhost:4000/api/admin/businesses/demo', {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer token',
      },
      body: JSON.stringify({ business: {}, theme: {} }),
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:4000/api/admin/businesses/demo',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
        }),
      }),
    );
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './apiClient.js';

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  it('aborts requests that exceed the configured timeout and returns a controlled timeout error', async () => {
    vi.useFakeTimers();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, options = {}) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );

    const requestPromise = apiRequest('http://localhost:4000/api/public/site/demo/orders', {
      method: 'POST',
      timeoutMs: 25,
      body: JSON.stringify({ ok: true }),
    });
    const rejectionExpectation = expect(requestPromise).rejects.toMatchObject({
      code: 'timeout_error',
      status: 408,
      message: 'A requisicao demorou mais que o esperado. Tente novamente.',
    });

    await vi.advanceTimersByTimeAsync(30);

    await rejectionExpectation;

    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});

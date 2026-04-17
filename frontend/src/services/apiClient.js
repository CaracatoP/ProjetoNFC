export class ApiClientError extends Error {
  constructor(message, status = 500, details) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest(url, options = {}, schema) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    headers,
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new ApiClientError(
      payload.error?.message || 'Falha ao processar a requisição',
      response.status,
      payload.error?.details,
    );
  }

  return schema ? schema.parse(payload) : payload;
}

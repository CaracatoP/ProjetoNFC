export class ApiClientError extends Error {
  constructor(message, status = 500, details) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest(url, options = {}, schema) {
  const { headers: customHeaders = {}, ...restOptions } = options;
  const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : restOptions.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...customHeaders,
  };

  const response = await fetch(url, {
    headers,
    ...restOptions,
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

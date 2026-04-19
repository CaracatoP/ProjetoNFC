export class ApiClientError extends Error {
  constructor(message, status = 500, details, code = 'api_error') {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

export async function apiRequest(url, options = {}, schema) {
  const { headers: customHeaders = {}, ...restOptions } = options;
  const isFormData = typeof FormData !== 'undefined' && restOptions.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : restOptions.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...customHeaders,
  };

  let response;

  try {
    response = await fetch(url, {
      headers,
      ...restOptions,
    });
  } catch (_networkError) {
    throw new ApiClientError('Nao foi possivel conectar com a API', 0, undefined, 'network_error');
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.success === false) {
    throw new ApiClientError(
      payload.error?.message || 'Falha ao processar a requisicao',
      response.status,
      payload.error?.details,
      payload.error?.code || 'api_error',
    );
  }

  return schema ? schema.parse(payload) : payload;
}

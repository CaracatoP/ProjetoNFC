import { logger } from '../../utils/logger.js';
import { decryptSecret } from '../../utils/secretCrypto.js';
import { getAsaasRuntimeConfig } from './asaas.config.js';
import {
  AsaasNotConfiguredError,
  AsaasUnavailableError,
  buildAsaasErrorFromResponse,
} from './asaas.errors.js';

function resolveAsaasApiKey(apiKey) {
  const normalizedApiKey = String(apiKey || '').trim();

  if (!normalizedApiKey) {
    return '';
  }

  if (normalizedApiKey.startsWith('v1:')) {
    return decryptSecret(normalizedApiKey);
  }

  return normalizedApiKey;
}

function normalizePath(path) {
  const normalizedPath = String(path || '').trim();

  if (!normalizedPath.startsWith('/')) {
    return `/${normalizedPath}`;
  }

  return normalizedPath;
}

async function parseResponseBody(response) {
  const text = await response.text().catch(() => '');

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function buildSafeLogContext({ method, path, operation, environment, status, durationMs }) {
  return {
    provider: 'asaas',
    operation: operation || `${method} ${path}`,
    method,
    path,
    environment,
    status,
    durationMs,
  };
}

export function createAsaasClient(options = {}) {
  const apiKey = resolveAsaasApiKey(options.apiKey);
  const config = getAsaasRuntimeConfig({ apiKey, requireApiKey: options.requireApiKey !== false });

  async function request({ method = 'GET', path, body, operation } = {}) {
    if (!config.configured && options.requireApiKey !== false) {
      throw new AsaasNotConfiguredError();
    }

    const normalizedMethod = String(method || 'GET').trim().toUpperCase();
    const normalizedPath = normalizePath(path);
    const controller = new AbortController();
    const startedAt = Date.now();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${config.baseUrl}${normalizedPath}`, {
        method: normalizedMethod,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          access_token: config.apiKey,
          'content-type': 'application/json',
          'user-agent': config.userAgent,
        },
        ...(body !== undefined && normalizedMethod !== 'GET' ? { body: JSON.stringify(body) } : {}),
      });
      const payload = await parseResponseBody(response);
      const durationMs = Date.now() - startedAt;

      logger.debug(
        buildSafeLogContext({
          method: normalizedMethod,
          path: normalizedPath,
          operation,
          environment: config.environment,
          status: response.status,
          durationMs,
        }),
        'Asaas request completed',
      );

      if (!response.ok) {
        throw buildAsaasErrorFromResponse(response.status, payload);
      }

      return payload;
    } catch (error) {
      const durationMs = Date.now() - startedAt;

      if (error?.name === 'AbortError') {
        logger.warn(
          buildSafeLogContext({
            method: normalizedMethod,
            path: normalizedPath,
            operation,
            environment: config.environment,
            status: 'timeout',
            durationMs,
          }),
          'Asaas request timed out',
        );
        throw new AsaasUnavailableError('Tempo de resposta do Asaas excedido.');
      }

      if (error?.statusCode) {
        throw error;
      }

      logger.warn(
        {
          ...buildSafeLogContext({
            method: normalizedMethod,
            path: normalizedPath,
            operation,
            environment: config.environment,
            status: 'network_error',
            durationMs,
          }),
          err: error,
        },
        'Asaas request failed',
      );
      throw new AsaasUnavailableError();
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    config: {
      environment: config.environment,
      baseUrl: config.baseUrl,
      configured: config.configured,
      timeoutMs: config.timeoutMs,
    },
    request,
  };
}

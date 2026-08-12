import { env } from '../../config/env.js';

export const ASAAS_ENVIRONMENTS = Object.freeze({
  SANDBOX: 'sandbox',
  PRODUCTION: 'production',
});

export const ASAAS_BASE_URLS = Object.freeze({
  [ASAAS_ENVIRONMENTS.SANDBOX]: 'https://api-sandbox.asaas.com/v3',
  [ASAAS_ENVIRONMENTS.PRODUCTION]: 'https://api.asaas.com/v3',
});

export const DEFAULT_ASAAS_TIMEOUT_MS = 10000;
export const ASAAS_USER_AGENT = 'TapLink/1.0 (+https://taplink.local)';

export function normalizeAsaasEnvironment(value = env.asaasEnv) {
  const normalized = String(value || '').trim().toLowerCase();

  return normalized === ASAAS_ENVIRONMENTS.PRODUCTION
    ? ASAAS_ENVIRONMENTS.PRODUCTION
    : ASAAS_ENVIRONMENTS.SANDBOX;
}

export function resolveAsaasBaseUrl(environment = env.asaasEnv) {
  return ASAAS_BASE_URLS[normalizeAsaasEnvironment(environment)];
}

export function resolveAsaasTimeoutMs(value = env.asaasRequestTimeoutMs) {
  const timeoutMs = Number(value);

  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return DEFAULT_ASAAS_TIMEOUT_MS;
  }

  return Math.min(Math.trunc(timeoutMs), 30000);
}

export function getAsaasRuntimeConfig({ apiKey, requireApiKey = true } = {}) {
  const environment = normalizeAsaasEnvironment(env.asaasEnv);
  const normalizedApiKey = String(apiKey ?? env.asaasApiKey ?? '').trim();

  return {
    environment,
    baseUrl: resolveAsaasBaseUrl(environment),
    apiKey: normalizedApiKey,
    configured: Boolean(normalizedApiKey),
    timeoutMs: resolveAsaasTimeoutMs(),
    userAgent: ASAAS_USER_AGENT,
    missingReason: requireApiKey && !normalizedApiKey ? 'ASAAS_NOT_CONFIGURED' : '',
  };
}

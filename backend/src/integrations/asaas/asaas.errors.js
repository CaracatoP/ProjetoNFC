import { AppError } from '../../utils/appError.js';

export class AsaasIntegrationError extends AppError {
  constructor(message, statusCode = 502, code = 'asaas_integration_error', details = undefined) {
    super(message, statusCode, code, details);
  }
}

export class AsaasNotConfiguredError extends AsaasIntegrationError {
  constructor() {
    super('Integracao Asaas nao configurada.', 400, 'ASAAS_NOT_CONFIGURED');
  }
}

export class AsaasAuthenticationError extends AsaasIntegrationError {
  constructor(message = 'Credenciais Asaas invalidas.') {
    super(message, 400, 'asaas_authentication_error');
  }
}

export class AsaasValidationError extends AsaasIntegrationError {
  constructor(message = 'Payload rejeitado pelo Asaas.', details = undefined) {
    super(message, 400, 'asaas_validation_error', details);
  }
}

export class AsaasRateLimitError extends AsaasIntegrationError {
  constructor(message = 'Limite de requisicoes do Asaas atingido.', details = undefined) {
    super(message, 429, 'asaas_rate_limit', details);
  }
}

export class AsaasUnavailableError extends AsaasIntegrationError {
  constructor(message = 'Asaas indisponivel no momento.') {
    super(message, 502, 'asaas_unavailable');
  }
}

export function sanitizeAsaasErrorPayload(payload = {}) {
  const errors = Array.isArray(payload?.errors) ? payload.errors : [];

  return errors
    .map((item) => ({
      code: String(item?.code || '').trim(),
      description: String(item?.description || '').trim(),
    }))
    .filter((item) => item.code || item.description);
}

function inferAsaasErrorField(description = '') {
  const normalizedDescription = String(description || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalizedDescription.includes('tipo de empresa') || normalizedDescription.includes('companytype')) {
    return 'companyType';
  }

  if (normalizedDescription.includes('faturamento') || normalizedDescription.includes('renda mensal') || normalizedDescription.includes('incomevalue')) {
    return 'incomeValue';
  }

  if (normalizedDescription.includes('cpf') || normalizedDescription.includes('cnpj')) {
    return 'cpfCnpj';
  }

  if (normalizedDescription.includes('e-mail') || normalizedDescription.includes('email')) {
    return 'email';
  }

  if (normalizedDescription.includes('celular') || normalizedDescription.includes('telefone')) {
    return 'mobilePhone';
  }

  if (normalizedDescription.includes('cep') || normalizedDescription.includes('postalcode')) {
    return 'postalCode';
  }

  if (normalizedDescription.includes('logradouro') || normalizedDescription.includes('endereco') || normalizedDescription.includes('address')) {
    return 'address';
  }

  if (normalizedDescription.includes('numero')) {
    return 'addressNumber';
  }

  if (normalizedDescription.includes('bairro') || normalizedDescription.includes('province')) {
    return 'province';
  }

  return undefined;
}

export function getAsaasErrorMessage(payload = {}, fallback = 'Nao foi possivel concluir a operacao com o Asaas no momento.') {
  const errors = sanitizeAsaasErrorPayload(payload);
  const firstDescription = String(errors[0]?.description || '').trim();

  return firstDescription || fallback;
}

export function buildAsaasErrorFromResponse(status, payload = {}, details = undefined) {
  const safeErrors = sanitizeAsaasErrorPayload(payload);
  const normalizedErrors = safeErrors.map((error) => ({
    provider: 'asaas',
    status,
    code: error.code,
    message: error.description,
    description: error.description,
    field: inferAsaasErrorField(error.description),
  }));
  const message = getAsaasErrorMessage(payload);

  if (status === 401 || status === 403) {
    return new AsaasAuthenticationError(message);
  }

  if (status === 429) {
    return new AsaasRateLimitError(message, {
      ...(details || {}),
      errors: normalizedErrors,
    });
  }

  if (status >= 400 && status < 500) {
    return new AsaasValidationError(message, normalizedErrors);
  }

  return new AsaasUnavailableError(message);
}

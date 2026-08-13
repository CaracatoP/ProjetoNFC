export const CUSTOMER_DOCUMENT_TYPES = {
  CPF: 'cpf',
  CNPJ: 'cnpj',
};

export function normalizeCustomerDocument(value = '') {
  return String(value || '').replace(/\D/g, '').slice(0, 14);
}

export function inferCustomerDocumentType(value = '') {
  const normalizedValue = normalizeCustomerDocument(value);

  if (normalizedValue.length === 11) {
    return CUSTOMER_DOCUMENT_TYPES.CPF;
  }

  if (normalizedValue.length === 14) {
    return CUSTOMER_DOCUMENT_TYPES.CNPJ;
  }

  return '';
}

export function formatCustomerDocument(value = '') {
  const normalizedValue = normalizeCustomerDocument(value);

  if (normalizedValue.length <= 11) {
    if (normalizedValue.length <= 3) {
      return normalizedValue;
    }

    if (normalizedValue.length <= 6) {
      return `${normalizedValue.slice(0, 3)}.${normalizedValue.slice(3)}`;
    }

    if (normalizedValue.length <= 9) {
      return `${normalizedValue.slice(0, 3)}.${normalizedValue.slice(3, 6)}.${normalizedValue.slice(6)}`;
    }

    return `${normalizedValue.slice(0, 3)}.${normalizedValue.slice(3, 6)}.${normalizedValue.slice(6, 9)}-${normalizedValue.slice(9)}`;
  }

  if (normalizedValue.length <= 2) {
    return normalizedValue;
  }

  if (normalizedValue.length <= 5) {
    return `${normalizedValue.slice(0, 2)}.${normalizedValue.slice(2)}`;
  }

  if (normalizedValue.length <= 8) {
    return `${normalizedValue.slice(0, 2)}.${normalizedValue.slice(2, 5)}.${normalizedValue.slice(5)}`;
  }

  if (normalizedValue.length <= 12) {
    return `${normalizedValue.slice(0, 2)}.${normalizedValue.slice(2, 5)}.${normalizedValue.slice(5, 8)}/${normalizedValue.slice(8)}`;
  }

  return `${normalizedValue.slice(0, 2)}.${normalizedValue.slice(2, 5)}.${normalizedValue.slice(5, 8)}/${normalizedValue.slice(8, 12)}-${normalizedValue.slice(12)}`;
}

export function isValidCpf(value = '') {
  const digits = normalizeCustomerDocument(value);

  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) {
    return false;
  }

  let sum = 0;

  for (let index = 0; index < 9; index += 1) {
    sum += Number(digits[index]) * (10 - index);
  }

  let remainder = (sum * 10) % 11;

  if (remainder === 10) {
    remainder = 0;
  }

  if (remainder !== Number(digits[9])) {
    return false;
  }

  sum = 0;

  for (let index = 0; index < 10; index += 1) {
    sum += Number(digits[index]) * (11 - index);
  }

  remainder = (sum * 10) % 11;

  if (remainder === 10) {
    remainder = 0;
  }

  return remainder === Number(digits[10]);
}

export function isValidCnpj(value = '') {
  const digits = normalizeCustomerDocument(value);

  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  const weights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;

  for (let index = 0; index < 12; index += 1) {
    sum += Number(digits[index]) * weights[index + 1];
  }

  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;

  if (firstDigit !== Number(digits[12])) {
    return false;
  }

  sum = 0;

  for (let index = 0; index < 13; index += 1) {
    sum += Number(digits[index]) * weights[index];
  }

  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;

  return secondDigit === Number(digits[13]);
}

export function validateCustomerDocument(value = '', { required = false } = {}) {
  const normalizedValue = normalizeCustomerDocument(value);

  if (!normalizedValue) {
    return {
      normalizedValue,
      type: '',
      isValid: !required,
      errorCode: required ? 'document_required' : '',
      message: required ? 'Informe seu CPF ou CNPJ.' : '',
    };
  }

  if (normalizedValue.length === 11) {
    const isValid = isValidCpf(normalizedValue);

    return {
      normalizedValue,
      type: CUSTOMER_DOCUMENT_TYPES.CPF,
      isValid,
      errorCode: isValid ? '' : 'cpf_invalid',
      message: isValid ? '' : 'CPF inválido.',
    };
  }

  if (normalizedValue.length === 14) {
    const isValid = isValidCnpj(normalizedValue);

    return {
      normalizedValue,
      type: CUSTOMER_DOCUMENT_TYPES.CNPJ,
      isValid,
      errorCode: isValid ? '' : 'cnpj_invalid',
      message: isValid ? '' : 'CNPJ inválido.',
    };
  }

  return {
    normalizedValue,
    type: '',
    isValid: false,
    errorCode: 'document_invalid',
    message: 'Informe um CPF ou CNPJ válido.',
  };
}

import { appConfig } from '@/config/appConfig.js';
import { apiRequest } from '@/services/apiClient.js';
import { buildSessionAuthHeaders } from '@/services/authService.js';
import { normalizeEditorPayload } from '@/services/mediaNormalizer.js';
import { resolveMediaUrl } from '@/utils/formatters.js';

function buildClientPanelQuery(options = {}) {
  const params = new URLSearchParams();

  Object.entries(options).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    params.set(key, typeof value === 'boolean' ? String(Number(value)) : String(value));
  });

  return params.toString();
}

export async function fetchClientPanelBusiness(token, options = {}) {
  const query = buildClientPanelQuery(options);
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/business${query ? `?${query}` : ''}`, {
    headers: buildSessionAuthHeaders(token),
  });

  return normalizeEditorPayload(response.data);
}

export async function updateClientPanelBusinessBasics(token, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/business/basics`, {
    method: 'PUT',
    headers: buildSessionAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return normalizeEditorPayload(response.data);
}

export async function fetchClientPanelAnalytics(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/analytics`, {
    headers: buildSessionAuthHeaders(token),
  });

  return response.data;
}

export async function fetchClientPanelFinance(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/finance`, {
    headers: buildSessionAuthHeaders(token),
  });

  return response.data;
}

export async function fetchClientPanelProducts(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/products`, {
    headers: buildSessionAuthHeaders(token),
  });

  return response.data;
}

export async function fetchClientPanelProfessionals(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/professionals`, {
    headers: buildSessionAuthHeaders(token),
  });

  return response.data;
}

export async function fetchClientPanelAppointmentServices(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/appointment-services`, {
    headers: buildSessionAuthHeaders(token),
  });

  return response.data;
}

export async function fetchClientPanelOrders(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/orders`, {
    headers: buildSessionAuthHeaders(token),
  });

  return response.data;
}

export async function fetchClientPanelAppointmentRequests(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/appointment-requests`, {
    headers: buildSessionAuthHeaders(token),
  });

  return response.data;
}

export async function uploadClientPanelImage(token, file, options = {}) {
  const formData = new FormData();
  formData.append('file', file);
  if (options.assetType) {
    formData.append('assetType', options.assetType);
  }

  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/uploads/image`, {
    method: 'POST',
    headers: buildSessionAuthHeaders(token),
    body: formData,
  });

  return {
    ...response.data,
    url: resolveMediaUrl(response.data.url),
  };
}

export async function createClientPanelProduct(token, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/products`, {
    method: 'POST',
    headers: buildSessionAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function updateClientPanelProduct(token, productId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/products/${productId}`, {
    method: 'PUT',
    headers: buildSessionAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function deleteClientPanelProduct(token, productId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/products/${productId}`, {
    method: 'DELETE',
    headers: buildSessionAuthHeaders(token),
  });

  return response.data;
}

export async function createClientPanelProfessional(token, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/professionals`, {
    method: 'POST',
    headers: buildSessionAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function updateClientPanelProfessional(token, professionalId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/professionals/${professionalId}`, {
    method: 'PUT',
    headers: buildSessionAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function deleteClientPanelProfessional(token, professionalId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/professionals/${professionalId}`, {
    method: 'DELETE',
    headers: buildSessionAuthHeaders(token),
  });

  return response.data;
}

export async function createClientPanelAppointmentService(token, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/appointment-services`, {
    method: 'POST',
    headers: buildSessionAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function updateClientPanelAppointmentService(token, serviceId, payload) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/appointment-services/${serviceId}`, {
    method: 'PUT',
    headers: buildSessionAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function deleteClientPanelAppointmentService(token, serviceId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/appointment-services/${serviceId}`, {
    method: 'DELETE',
    headers: buildSessionAuthHeaders(token),
  });

  return response.data;
}

export async function updateClientPanelOrderStatus(token, orderId, status) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: buildSessionAuthHeaders(token),
    body: JSON.stringify({ status }),
  });

  return response.data;
}

export async function updateClientPanelOrderPaymentStatus(token, orderId, status) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/orders/${orderId}/payment-status`, {
    method: 'PATCH',
    headers: buildSessionAuthHeaders(token),
    body: JSON.stringify({ status }),
  });

  return response.data;
}

export async function deleteClientPanelOrder(token, orderId) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/orders/${orderId}`, {
    method: 'DELETE',
    headers: buildSessionAuthHeaders(token),
  });

  return response.data;
}

export async function updateClientPanelAppointmentRequestStatus(token, requestId, status) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/panel/appointment-requests/${requestId}/status`, {
    method: 'PATCH',
    headers: buildSessionAuthHeaders(token),
    body: JSON.stringify({ status }),
  });

  return response.data;
}

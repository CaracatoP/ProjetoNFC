import { appConfig } from '@/config/appConfig.js';
import { apiRequest } from '@/services/apiClient.js';

const ADMIN_TOKEN_KEY = 'taplink_admin_session_token';
const LEGACY_ADMIN_TOKEN_KEY = 'nfc_admin_session_token';

export function getStoredAdminToken() {
  return window.localStorage.getItem(ADMIN_TOKEN_KEY) || window.localStorage.getItem(LEGACY_ADMIN_TOKEN_KEY) || '';
}

export function setStoredAdminToken(token) {
  if (!token) {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
    return;
  }

  window.localStorage.setItem(ADMIN_TOKEN_KEY, token);
  window.localStorage.removeItem(LEGACY_ADMIN_TOKEN_KEY);
}

export function buildAdminAuthHeaders(token) {
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

export function getStoredSessionToken() {
  return getStoredAdminToken();
}

export function setStoredSessionToken(token) {
  setStoredAdminToken(token);
}

export function buildSessionAuthHeaders(token) {
  return buildAdminAuthHeaders(token);
}

export async function loginSession(credentials) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  return response.data;
}

export async function fetchSession(token) {
  const response = await apiRequest(`${appConfig.apiBaseUrl}/auth/me`, {
    headers: buildSessionAuthHeaders(token),
  });

  return response.data;
}

export async function logoutSession(token) {
  await apiRequest(`${appConfig.apiBaseUrl}/auth/logout`, {
    method: 'POST',
    headers: buildSessionAuthHeaders(token),
  });
}

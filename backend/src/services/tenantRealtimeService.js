import { EventEmitter } from 'node:events';
import { normalizeHost } from '../../../shared/utils/tenantIdentity.js';

const tenantRealtimeEmitter = new EventEmitter();
const TENANT_UPDATED_EVENT = 'tenant.updated';

tenantRealtimeEmitter.setMaxListeners(0);

function normalizeOptionalValue(value) {
  const normalized = String(value || '').trim();
  return normalized || '';
}

function buildEventPayload(payload = {}) {
  return {
    operation: String(payload.operation || 'updated'),
    businessId: normalizeOptionalValue(payload.businessId),
    slug: normalizeOptionalValue(payload.slug),
    previousSlug: normalizeOptionalValue(payload.previousSlug),
    status: normalizeOptionalValue(payload.status),
    publicUrl: normalizeOptionalValue(payload.publicUrl),
    domains: {
      subdomain: normalizeOptionalValue(payload.domains?.subdomain).toLowerCase(),
      customDomain: normalizeHost(payload.domains?.customDomain),
    },
    previousDomains: {
      subdomain: normalizeOptionalValue(payload.previousDomains?.subdomain).toLowerCase(),
      customDomain: normalizeHost(payload.previousDomains?.customDomain),
    },
    emittedAt: new Date().toISOString(),
  };
}

function matchesTarget(target = {}, payload = {}) {
  const targetBusinessId = normalizeOptionalValue(target.businessId);
  const targetSlug = normalizeOptionalValue(target.slug);
  const targetHost = normalizeHost(target.host);

  if (targetBusinessId && payload.businessId === targetBusinessId) {
    return true;
  }

  if (targetSlug && [payload.slug, payload.previousSlug].filter(Boolean).includes(targetSlug)) {
    return true;
  }

  if (!targetHost) {
    return false;
  }

  const possibleDomains = [
    payload.domains?.customDomain,
    payload.previousDomains?.customDomain,
  ].filter(Boolean);

  if (possibleDomains.includes(targetHost)) {
    return true;
  }

  const possibleSubdomains = [
    payload.domains?.subdomain,
    payload.previousDomains?.subdomain,
  ].filter(Boolean);

  return possibleSubdomains.some((subdomain) => targetHost.startsWith(`${subdomain}.`));
}

export function publishTenantUpdated(payload = {}) {
  const eventPayload = buildEventPayload(payload);
  tenantRealtimeEmitter.emit(TENANT_UPDATED_EVENT, eventPayload);
  return eventPayload;
}

export function subscribeToTenantUpdates(target, listener) {
  const handler = (payload) => {
    if (matchesTarget(target, payload)) {
      listener(payload);
    }
  };

  tenantRealtimeEmitter.on(TENANT_UPDATED_EVENT, handler);

  return () => {
    tenantRealtimeEmitter.off(TENANT_UPDATED_EVENT, handler);
  };
}

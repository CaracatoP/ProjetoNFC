import { describe, expect, it, vi } from 'vitest';
import { TENANT_REALTIME_KINDS } from '../../../shared/constants/tenantRealtime.js';
import { publishTenantUpdated, subscribeToTenantUpdates } from './tenantRealtimeService.js';

describe('tenantRealtimeService', () => {
  it('notifies subscribers that are tracking the tenant by slug', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTenantUpdates({ slug: 'barbearia-estilo-vivo' }, listener);

    publishTenantUpdated({
      businessId: 'business-1',
      slug: 'barbearia-estilo-vivo',
      status: 'active',
      operation: 'updated',
      kind: TENANT_REALTIME_KINDS.PRODUCT_UPDATED,
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'business-1',
        slug: 'barbearia-estilo-vivo',
        operation: 'updated',
        kind: TENANT_REALTIME_KINDS.PRODUCT_UPDATED,
      }),
    );

    unsubscribe();
  });

  it('matches updates for the same tenant by business id even when the slug changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTenantUpdates({ businessId: 'business-1' }, listener);

    publishTenantUpdated({
      businessId: 'business-1',
      slug: 'barbearia-estilo-vivo-premium',
      previousSlug: 'barbearia-estilo-vivo',
      status: 'active',
      operation: 'updated',
      kind: TENANT_REALTIME_KINDS.TENANT_UPDATED,
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'business-1',
        slug: 'barbearia-estilo-vivo-premium',
        previousSlug: 'barbearia-estilo-vivo',
        kind: TENANT_REALTIME_KINDS.TENANT_UPDATED,
      }),
    );

    unsubscribe();
  });

  it('defaults the realtime kind to tenant_updated when the caller does not provide one', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTenantUpdates({ slug: 'barbearia-estilo-vivo' }, listener);

    publishTenantUpdated({
      businessId: 'business-1',
      slug: 'barbearia-estilo-vivo',
      status: 'active',
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: TENANT_REALTIME_KINDS.TENANT_UPDATED,
      }),
    );

    unsubscribe();
  });
});

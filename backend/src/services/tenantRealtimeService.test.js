import { describe, expect, it, vi } from 'vitest';
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
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'business-1',
        slug: 'barbearia-estilo-vivo',
        operation: 'updated',
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
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: 'business-1',
        slug: 'barbearia-estilo-vivo-premium',
        previousSlug: 'barbearia-estilo-vivo',
      }),
    );

    unsubscribe();
  });
});

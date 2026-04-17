import { env } from '../config/env.js';
import { getDashboardOverviewSummary } from '../repositories/adminRepository.js';

export async function getAdminDashboardOverview() {
  const summary = await getDashboardOverviewSummary();
  const countsMap = new Map(summary.businessCounts.map((item) => [item._id, item.count]));

  return {
    totals: {
      businesses: Array.from(countsMap.values()).reduce((total, value) => total + value, 0),
      activeBusinesses: countsMap.get('active') || 0,
      draftBusinesses: countsMap.get('draft') || 0,
      inactiveBusinesses: countsMap.get('inactive') || 0,
      totalEvents: summary.eventTotals.totalEvents || 0,
      last7DaysEvents: summary.eventTotals.last7DaysEvents || 0,
    },
    topBusinesses: summary.topBusinesses.map((item) => ({
      businessId: String(item._id),
      name: item.business.name,
      slug: item.business.slug,
      status: item.business.status,
      eventCount: item.eventCount,
      lastEventAt: item.lastEventAt,
    })),
    recentEvents: summary.recentEvents.map((event) => ({
      id: String(event._id),
      eventType: event.eventType,
      targetLabel: event.targetLabel,
      occurredAt: event.occurredAt,
      businessName: event.business?.name || 'Negocio removido',
      businessSlug: event.business?.slug || null,
    })),
    uploadConfig: {
      maxFileSizeMb: env.maxUploadMb,
      acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    },
  };
}

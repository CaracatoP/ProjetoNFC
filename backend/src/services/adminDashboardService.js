import { env } from '../config/env.js';
import { getDashboardOverviewSummary } from '../repositories/adminRepository.js';
import {
  buildDailyTimeline,
  buildEventTypeBreakdown,
  buildTopTargetBreakdown,
  buildUserAgentBreakdowns,
  calculateActionRate,
} from '../utils/adminAnalytics.js';
import { getAcceptedImageMimeTypes } from '../utils/imageValidation.js';

export async function getAdminDashboardOverview() {
  const summary = await getDashboardOverviewSummary();
  const countsMap = new Map(summary.businessCounts.map((item) => [item._id, item.count]));
  const totalEvents = summary.eventTotals.totalEvents || 0;
  const pageViews = summary.eventTotals.pageViews || 0;
  const linkClicks = summary.eventTotals.linkClicks || 0;
  const ctaClicks = summary.eventTotals.ctaClicks || 0;
  const copyActions = summary.eventTotals.copyActions || 0;
  const qrViews = summary.eventTotals.qrViews || 0;
  const interactions = linkClicks + ctaClicks + copyActions + qrViews;
  const topTenants = summary.topBusinesses.map((item) => ({
    businessId: String(item._id),
    name: item.business.name,
    slug: item.business.slug,
    status: item.business.status,
    eventCount: item.eventCount,
    lastEventAt: item.lastEventAt,
  }));
  const recentEvents = summary.recentEvents.map((event) => ({
    id: String(event._id),
    eventType: event.eventType,
    targetType: event.targetType,
    targetLabel: event.targetLabel,
    occurredAt: event.occurredAt,
    businessName: event.business?.name || 'Negocio removido',
    businessSlug: event.business?.slug || null,
  }));

  return {
    totals: {
      businesses: Array.from(countsMap.values()).reduce((total, value) => total + value, 0),
      activeBusinesses: countsMap.get('active') || 0,
      draftBusinesses: countsMap.get('draft') || 0,
      inactiveBusinesses: countsMap.get('inactive') || 0,
      totalEvents: summary.eventTotals.totalEvents || 0,
      last7DaysEvents: summary.eventTotals.last7DaysEvents || 0,
    },
    topBusinesses: topTenants,
    recentEvents,
    analytics: {
      highlights: {
        totalEvents,
        last7DaysEvents: summary.eventTotals.last7DaysEvents || 0,
        pageViews,
        linkClicks,
        ctaClicks,
        copyActions,
        shortcutClicks: summary.eventTotals.shortcutClicks || 0,
        uniqueVisitors: summary.uniqueVisitors || 0,
        actionRate: calculateActionRate(pageViews, interactions),
      },
      timeline: buildDailyTimeline(summary.dailyEvents),
      byEventType: buildEventTypeBreakdown(summary.byEventType, totalEvents),
      topLinks: buildTopTargetBreakdown(summary.topTargets, { limit: 6 }),
      topShortcuts: buildTopTargetBreakdown(summary.topTargets, { limit: 6, shortcutsOnly: true }),
      topTenants,
      recentEvents,
      ...buildUserAgentBreakdowns(summary.userAgents, totalEvents),
    },
    uploadConfig: {
      maxFileSizeMb: env.maxUploadMb,
      acceptedMimeTypes: getAcceptedImageMimeTypes(),
    },
  };
}

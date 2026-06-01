import mongoose from 'mongoose';
import { AnalyticsEvent } from '../models/AnalyticsEvent.js';
import { Business } from '../models/Business.js';
import { BusinessLink } from '../models/BusinessLink.js';
import { BusinessSection } from '../models/BusinessSection.js';
import { BusinessTheme } from '../models/BusinessTheme.js';
import { NfcTag } from '../models/NfcTag.js';
import { Product } from '../models/Product.js';
import { Professional } from '../models/Professional.js';
import { AppointmentService } from '../models/AppointmentService.js';
import { AppointmentRequest } from '../models/AppointmentRequest.js';
import { Order } from '../models/Order.js';
import { Subscription } from '../models/Subscription.js';
import { SHORTCUT_TARGET_TYPES } from '../utils/adminAnalytics.js';

const ADMIN_BUSINESS_LIST_PROJECTION = {
  name: 1,
  slug: 1,
  status: 1,
  analyticsBaselineAt: 1,
  segment: 1,
  modules: 1,
  logoUrl: 1,
  domains: 1,
  description: 1,
  createdAt: 1,
  updatedAt: 1,
};

const ANALYTICS_BASELINE_FALLBACK = new Date(0);

function buildAnalyticsBusinessLookupStages(options = {}) {
  return [
    {
      $lookup: {
        from: 'businesses',
        localField: options.localField || 'businessId',
        foreignField: '_id',
        as: options.as || 'business',
      },
    },
    {
      $unwind: {
        path: `$${options.as || 'business'}`,
        preserveNullAndEmptyArrays: Boolean(options.preserveNullAndEmptyArrays),
      },
    },
  ];
}

function buildAnalyticsBaselineMatchStage(fieldPath = '$business.analyticsBaselineAt') {
  return {
    $match: {
      $expr: {
        $gte: ['$occurredAt', { $ifNull: [fieldPath, ANALYTICS_BASELINE_FALLBACK] }],
      },
    },
  };
}

function resolveOccurredAtFloor(baselineAt, comparisonDate = null) {
  if (baselineAt && comparisonDate) {
    return baselineAt > comparisonDate ? baselineAt : comparisonDate;
  }

  return baselineAt || comparisonDate || null;
}

export async function listBusinessesForAdmin() {
  return Business.find({}, ADMIN_BUSINESS_LIST_PROJECTION).sort({ createdAt: -1 }).lean();
}

export async function findBusinessGraphForAdmin(businessId) {
  const [business, theme, sections, links, nfcTag] = await Promise.all([
    Business.findById(businessId).lean(),
    BusinessTheme.findOne({ businessId }).lean(),
    BusinessSection.find({ businessId }).sort({ order: 1, createdAt: 1 }).lean(),
    BusinessLink.find({ businessId }).sort({ order: 1, createdAt: 1 }).lean(),
    NfcTag.findOne({ businessId }).lean(),
  ]);

  return {
    business,
    theme,
    sections,
    links,
    nfcTag,
  };
}

export async function createBusinessRecord(payload) {
  return Business.create(payload);
}

export async function updateBusinessRecord(businessId, payload) {
  return Business.findByIdAndUpdate(businessId, payload, {
    new: true,
    runValidators: true,
  });
}

export async function appendBusinessHistoryEntries(businessId, entries = []) {
  if (!entries.length) {
    return null;
  }

  return Business.findByIdAndUpdate(
    businessId,
    {
      $push: {
        history: {
          $each: entries,
          $slice: -120,
        },
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );
}

export async function upsertThemeRecord(businessId, payload) {
  return BusinessTheme.findOneAndUpdate(
    { businessId },
    { ...payload, businessId },
    { upsert: true, new: true, runValidators: true },
  );
}

export async function replaceSectionRecords(businessId, sections) {
  await BusinessSection.deleteMany({ businessId });

  if (!sections.length) {
    return [];
  }

  return BusinessSection.insertMany(
    sections.map((section) => ({
      ...section,
      businessId,
    })),
  );
}

export async function replaceLinkRecords(businessId, links) {
  await BusinessLink.deleteMany({ businessId });

  if (!links.length) {
    return [];
  }

  return BusinessLink.insertMany(
    links.map((link) => ({
      ...link,
      businessId,
    })),
  );
}

export async function upsertNfcTagRecord(businessId, payload) {
  if (!payload?.code) {
    await NfcTag.deleteMany({ businessId });
    return null;
  }

  return NfcTag.findOneAndUpdate(
    { businessId },
    { ...payload, businessId },
    { upsert: true, new: true, runValidators: true },
  );
}

export async function deleteBusinessGraphRecords(businessId) {
  await Promise.all([
    Business.findByIdAndDelete(businessId),
    BusinessTheme.deleteMany({ businessId }),
    BusinessSection.deleteMany({ businessId }),
    BusinessLink.deleteMany({ businessId }),
    NfcTag.deleteMany({ businessId }),
    AnalyticsEvent.deleteMany({ businessId }),
    Product.deleteMany({ businessId }),
    Professional.deleteMany({ businessId }),
    AppointmentService.deleteMany({ businessId }),
    AppointmentRequest.deleteMany({ businessId }),
    Order.deleteMany({ businessId }),
    Subscription.deleteMany({ businessId }),
  ]);
}

export async function resetAnalyticsBaselineForAllBusinesses(baselineAt = new Date()) {
  const normalizedBaseline = baselineAt instanceof Date ? baselineAt : new Date(baselineAt);
  const updateResult = await Business.updateMany({}, { $set: { analyticsBaselineAt: normalizedBaseline } });

  return {
    baselineAt: normalizedBaseline,
    updatedBusinesses: updateResult.modifiedCount ?? updateResult.matchedCount ?? 0,
  };
}

export async function getAnalyticsCountsByBusinessIds(businessIds) {
  if (!businessIds.length) {
    return [];
  }

  return AnalyticsEvent.aggregate([
    { $match: { businessId: { $in: businessIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    ...buildAnalyticsBusinessLookupStages(),
    buildAnalyticsBaselineMatchStage(),
    {
      $group: {
        _id: '$businessId',
        totalEvents: { $sum: 1 },
        lastEventAt: { $max: '$occurredAt' },
        pageViews: {
          $sum: {
            $cond: [{ $eq: ['$eventType', 'page_view'] }, 1, 0],
          },
        },
        linkClicks: {
          $sum: {
            $cond: [{ $eq: ['$eventType', 'link_click'] }, 1, 0],
          },
        },
      },
    },
  ]);
}

export async function getBusinessAnalyticsSummary(businessId) {
  const businessObjectId = new mongoose.Types.ObjectId(businessId);
  const business = await Business.findById(businessId, { analyticsBaselineAt: 1 }).lean();
  const baselineAt = business?.analyticsBaselineAt || null;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const baselineMatch = baselineAt ? { occurredAt: { $gte: baselineAt } } : {};
  const fourteenDayWindowStart = resolveOccurredAtFloor(baselineAt, fourteenDaysAgo);

  const [totals, recentEvents, byEventType, dailyEvents, topTargets, uniqueVisitors, userAgents] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: { businessId: businessObjectId, ...baselineMatch } },
      {
        $group: {
          _id: '$businessId',
          totalEvents: { $sum: 1 },
          last7DaysEvents: {
            $sum: {
              $cond: [{ $gte: ['$occurredAt', sevenDaysAgo] }, 1, 0],
            },
          },
          pageViews: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'page_view'] }, 1, 0],
            },
          },
          linkClicks: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'link_click'] }, 1, 0],
            },
          },
          ctaClicks: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'cta_click'] }, 1, 0],
            },
          },
          copyActions: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'copy_action'] }, 1, 0],
            },
          },
          qrViews: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'qr_view'] }, 1, 0],
            },
          },
          shortcutClicks: {
            $sum: {
              $cond: [{ $in: ['$targetType', SHORTCUT_TARGET_TYPES] }, 1, 0],
            },
          },
        },
      },
    ]),
    AnalyticsEvent.find(
      { businessId, ...baselineMatch },
      {
        eventType: 1,
        sectionType: 1,
        targetType: 1,
        targetLabel: 1,
        occurredAt: 1,
      },
    )
      .sort({ occurredAt: -1 })
      .limit(12)
      .lean(),
    AnalyticsEvent.aggregate([
      { $match: { businessId: businessObjectId, ...baselineMatch } },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]),
    AnalyticsEvent.aggregate([
      {
        $match: {
          businessId: businessObjectId,
          occurredAt: { $gte: fourteenDayWindowStart || fourteenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt' } },
            eventType: '$eventType',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.day': 1 } },
    ]),
    AnalyticsEvent.aggregate([
      {
        $match: {
          businessId: businessObjectId,
          ...baselineMatch,
          eventType: { $in: ['link_click', 'cta_click', 'copy_action'] },
        },
      },
      {
        $group: {
          _id: {
            targetType: '$targetType',
            targetLabel: '$targetLabel',
          },
          count: { $sum: 1 },
          lastEventAt: { $max: '$occurredAt' },
        },
      },
      { $sort: { count: -1, lastEventAt: -1 } },
      { $limit: 20 },
    ]),
    AnalyticsEvent.aggregate([
      {
        $match: {
          businessId: businessObjectId,
          ...baselineMatch,
          visitorHash: { $nin: ['', null] },
        },
      },
      {
        $group: {
          _id: '$visitorHash',
        },
      },
      { $count: 'count' },
    ]),
    AnalyticsEvent.aggregate([
      {
        $match: {
          businessId: businessObjectId,
          ...baselineMatch,
          userAgent: { $nin: ['', null] },
        },
      },
      {
        $group: {
          _id: '$userAgent',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 24 },
    ]),
  ]);

  return {
    baselineAt,
    totals: totals[0] || {
      totalEvents: 0,
      last7DaysEvents: 0,
      pageViews: 0,
      linkClicks: 0,
      ctaClicks: 0,
      copyActions: 0,
      qrViews: 0,
      shortcutClicks: 0,
    },
    recentEvents,
    byEventType,
    dailyEvents,
    topTargets,
    uniqueVisitors: uniqueVisitors[0]?.count || 0,
    userAgents,
  };
}

export async function getDashboardOverviewSummary() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const [businessCounts, analyticsBaseline, eventTotals, topBusinesses, recentEvents, byEventType, dailyEvents, topTargets, uniqueVisitors, userAgents] = await Promise.all([
    Business.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    Business.aggregate([
      {
        $group: {
          _id: null,
          earliestBaselineAt: { $min: '$analyticsBaselineAt' },
          latestBaselineAt: { $max: '$analyticsBaselineAt' },
          configuredBusinesses: {
            $sum: {
              $cond: [{ $ifNull: ['$analyticsBaselineAt', false] }, 1, 0],
            },
          },
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      ...buildAnalyticsBusinessLookupStages(),
      buildAnalyticsBaselineMatchStage(),
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          last7DaysEvents: {
            $sum: {
              $cond: [{ $gte: ['$occurredAt', sevenDaysAgo] }, 1, 0],
            },
          },
          pageViews: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'page_view'] }, 1, 0],
            },
          },
          linkClicks: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'link_click'] }, 1, 0],
            },
          },
          ctaClicks: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'cta_click'] }, 1, 0],
            },
          },
          copyActions: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'copy_action'] }, 1, 0],
            },
          },
          qrViews: {
            $sum: {
              $cond: [{ $eq: ['$eventType', 'qr_view'] }, 1, 0],
            },
          },
          shortcutClicks: {
            $sum: {
              $cond: [{ $in: ['$targetType', SHORTCUT_TARGET_TYPES] }, 1, 0],
            },
          },
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      ...buildAnalyticsBusinessLookupStages(),
      buildAnalyticsBaselineMatchStage(),
      {
        $group: {
          _id: '$businessId',
          eventCount: { $sum: 1 },
          lastEventAt: { $max: '$occurredAt' },
          business: {
            $first: {
              name: '$business.name',
              slug: '$business.slug',
              status: '$business.status',
            },
          },
        },
      },
      { $sort: { eventCount: -1, lastEventAt: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 1,
          eventCount: 1,
          lastEventAt: 1,
          'business.name': 1,
          'business.slug': 1,
          'business.status': 1,
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      ...buildAnalyticsBusinessLookupStages({ preserveNullAndEmptyArrays: true }),
      buildAnalyticsBaselineMatchStage(),
      { $sort: { occurredAt: -1 } },
      { $limit: 12 },
      {
        $project: {
          eventType: 1,
          targetType: 1,
          targetLabel: 1,
          occurredAt: 1,
          'business.name': 1,
          'business.slug': 1,
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      ...buildAnalyticsBusinessLookupStages(),
      buildAnalyticsBaselineMatchStage(),
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]),
    AnalyticsEvent.aggregate([
      ...buildAnalyticsBusinessLookupStages(),
      buildAnalyticsBaselineMatchStage(),
      {
        $match: {
          occurredAt: { $gte: fourteenDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt' } },
            eventType: '$eventType',
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.day': 1 } },
    ]),
    AnalyticsEvent.aggregate([
      ...buildAnalyticsBusinessLookupStages({ preserveNullAndEmptyArrays: true }),
      buildAnalyticsBaselineMatchStage(),
      {
        $match: {
          eventType: { $in: ['link_click', 'cta_click', 'copy_action'] },
        },
      },
      {
        $group: {
          _id: {
            targetType: '$targetType',
            targetLabel: '$targetLabel',
            businessId: '$businessId',
          },
          count: { $sum: 1 },
          lastEventAt: { $max: '$occurredAt' },
          business: {
            $first: {
              name: '$business.name',
              slug: '$business.slug',
            },
          },
        },
      },
      { $sort: { count: -1, lastEventAt: -1 } },
      { $limit: 30 },
      {
        $project: {
          _id: 1,
          count: 1,
          lastEventAt: 1,
          'business.name': 1,
          'business.slug': 1,
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      ...buildAnalyticsBusinessLookupStages(),
      buildAnalyticsBaselineMatchStage(),
      {
        $match: {
          visitorHash: { $nin: ['', null] },
        },
      },
      {
        $group: {
          _id: '$visitorHash',
        },
      },
      { $count: 'count' },
    ]),
    AnalyticsEvent.aggregate([
      ...buildAnalyticsBusinessLookupStages(),
      buildAnalyticsBaselineMatchStage(),
      {
        $match: {
          userAgent: { $nin: ['', null] },
        },
      },
      {
        $group: {
          _id: '$userAgent',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 24 },
    ]),
  ]);

  return {
    businessCounts,
    analyticsBaseline: analyticsBaseline[0] || {
      earliestBaselineAt: null,
      latestBaselineAt: null,
      configuredBusinesses: 0,
    },
    eventTotals: eventTotals[0] || {
      totalEvents: 0,
      last7DaysEvents: 0,
      pageViews: 0,
      linkClicks: 0,
      ctaClicks: 0,
      copyActions: 0,
      qrViews: 0,
      shortcutClicks: 0,
    },
    topBusinesses,
    recentEvents,
    byEventType,
    dailyEvents,
    topTargets,
    uniqueVisitors: uniqueVisitors[0]?.count || 0,
    userAgents,
  };
}

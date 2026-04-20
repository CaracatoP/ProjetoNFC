import mongoose from 'mongoose';
import { AnalyticsEvent } from '../models/AnalyticsEvent.js';
import { Business } from '../models/Business.js';
import { BusinessLink } from '../models/BusinessLink.js';
import { BusinessSection } from '../models/BusinessSection.js';
import { BusinessTheme } from '../models/BusinessTheme.js';
import { NfcTag } from '../models/NfcTag.js';
import { Subscription } from '../models/Subscription.js';

export async function listBusinessesForAdmin() {
  return Business.find().sort({ createdAt: -1 }).lean();
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
    Subscription.deleteMany({ businessId }),
  ]);
}

export async function getAnalyticsCountsByBusinessIds(businessIds) {
  if (!businessIds.length) {
    return [];
  }

  return AnalyticsEvent.aggregate([
    { $match: { businessId: { $in: businessIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
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
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [totals, recentEvents, byEventType] = await Promise.all([
    AnalyticsEvent.aggregate([
      { $match: { businessId: businessObjectId } },
      {
        $group: {
          _id: '$businessId',
          totalEvents: { $sum: 1 },
          last7DaysEvents: {
            $sum: {
              $cond: [{ $gte: ['$occurredAt', sevenDaysAgo] }, 1, 0],
            },
          },
        },
      },
    ]),
    AnalyticsEvent.find({ businessId }).sort({ occurredAt: -1 }).limit(12).lean(),
    AnalyticsEvent.aggregate([
      { $match: { businessId: businessObjectId } },
      {
        $group: {
          _id: '$eventType',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]),
  ]);

  return {
    totals: totals[0] || { totalEvents: 0, last7DaysEvents: 0 },
    recentEvents,
    byEventType,
  };
}

export async function getDashboardOverviewSummary() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [businessCounts, eventTotals, topBusinesses, recentEvents] = await Promise.all([
    Business.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          last7DaysEvents: {
            $sum: {
              $cond: [{ $gte: ['$occurredAt', sevenDaysAgo] }, 1, 0],
            },
          },
        },
      },
    ]),
    AnalyticsEvent.aggregate([
      {
        $group: {
          _id: '$businessId',
          eventCount: { $sum: 1 },
          lastEventAt: { $max: '$occurredAt' },
        },
      },
      { $sort: { eventCount: -1, lastEventAt: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'businesses',
          localField: '_id',
          foreignField: '_id',
          as: 'business',
        },
      },
      { $unwind: '$business' },
    ]),
    AnalyticsEvent.aggregate([
      { $sort: { occurredAt: -1 } },
      { $limit: 12 },
      {
        $lookup: {
          from: 'businesses',
          localField: 'businessId',
          foreignField: '_id',
          as: 'business',
        },
      },
      {
        $unwind: {
          path: '$business',
          preserveNullAndEmptyArrays: true,
        },
      },
    ]),
  ]);

  return {
    businessCounts,
    eventTotals: eventTotals[0] || { totalEvents: 0, last7DaysEvents: 0 },
    topBusinesses,
    recentEvents,
  };
}

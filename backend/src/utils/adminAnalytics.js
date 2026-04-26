import { ANALYTICS_EVENT_TYPES } from '../../../shared/constants/index.js';

export const SHORTCUT_TARGET_TYPES = ['whatsapp', 'phone', 'email', 'wifi', 'pix', 'contact', 'hours'];

const INTERACTION_EVENT_TYPES = new Set([
  ANALYTICS_EVENT_TYPES.LINK_CLICK,
  ANALYTICS_EVENT_TYPES.CTA_CLICK,
  ANALYTICS_EVENT_TYPES.COPY_ACTION,
  ANALYTICS_EVENT_TYPES.QR_VIEW,
]);

const BROWSER_LABELS = [
  { label: 'Edge', test: (userAgent) => /edg\//i.test(userAgent) },
  { label: 'Chrome', test: (userAgent) => /chrome\//i.test(userAgent) && !/edg\//i.test(userAgent) && !/opr\//i.test(userAgent) },
  { label: 'Safari', test: (userAgent) => /safari\//i.test(userAgent) && !/chrome\//i.test(userAgent) },
  { label: 'Firefox', test: (userAgent) => /firefox\//i.test(userAgent) },
  { label: 'Opera', test: (userAgent) => /opr\//i.test(userAgent) || /opera/i.test(userAgent) },
];

function groupAndRank(entries = [], limit = 5) {
  return entries
    .filter((entry) => entry.count > 0)
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, 'pt-BR'))
    .slice(0, limit);
}

function calculateShare(count, total) {
  if (!total) {
    return 0;
  }

  return Number(((count / total) * 100).toFixed(1));
}

function humanizeToken(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getBrowserLabel(userAgent) {
  const normalized = String(userAgent || '').trim();

  if (!normalized) {
    return 'Desconhecido';
  }

  return BROWSER_LABELS.find((browser) => browser.test(normalized))?.label || 'Outro';
}

function getDeviceLabel(userAgent) {
  const normalized = String(userAgent || '').toLowerCase();

  if (!normalized) {
    return 'Desconhecido';
  }

  if (/ipad|tablet/i.test(normalized)) {
    return 'Tablet';
  }

  if (/iphone|android.+mobile|windows phone|mobile/i.test(normalized)) {
    return 'Mobile';
  }

  return 'Desktop';
}

function buildBreakdown(entries, total) {
  return groupAndRank(entries).map((entry) => ({
    ...entry,
    share: calculateShare(entry.count, total),
  }));
}

export function isShortcutTargetType(value) {
  return SHORTCUT_TARGET_TYPES.includes(String(value || '').trim().toLowerCase());
}

export function buildDailyTimeline(rows = [], days = 14) {
  const rowsByDay = rows.reduce((accumulator, row) => {
    const day = row?._id?.day;
    const eventType = row?._id?.eventType;

    if (!day || !eventType) {
      return accumulator;
    }

    const nextEntry = accumulator.get(day) || {};
    nextEntry[eventType] = row.count || 0;
    accumulator.set(day, nextEntry);
    return accumulator;
  }, new Map());

  const timeline = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() - offset);
    const key = currentDate.toISOString().slice(0, 10);
    const dayEvents = rowsByDay.get(key) || {};
    const pageViews = dayEvents[ANALYTICS_EVENT_TYPES.PAGE_VIEW] || 0;
    const linkClicks = dayEvents[ANALYTICS_EVENT_TYPES.LINK_CLICK] || 0;
    const copyActions = dayEvents[ANALYTICS_EVENT_TYPES.COPY_ACTION] || 0;
    const ctaClicks = dayEvents[ANALYTICS_EVENT_TYPES.CTA_CLICK] || 0;
    const qrViews = dayEvents[ANALYTICS_EVENT_TYPES.QR_VIEW] || 0;
    const totalEvents = Object.values(dayEvents).reduce((sum, count) => sum + count, 0);

    timeline.push({
      date: key,
      totalEvents,
      pageViews,
      linkClicks,
      interactions: linkClicks + copyActions + ctaClicks + qrViews,
    });
  }

  return timeline;
}

export function buildEventTypeBreakdown(rows = [], totalEvents = 0) {
  return rows
    .map((row) => ({
      eventType: row._id,
      label: humanizeToken(row._id),
      count: row.count || 0,
      share: calculateShare(row.count || 0, totalEvents),
    }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, 'pt-BR'));
}

export function buildTopTargetBreakdown(rows = [], { limit = 6, shortcutsOnly = false } = {}) {
  return rows
    .filter((row) => {
      const targetType = row?._id?.targetType;
      return shortcutsOnly ? isShortcutTargetType(targetType) : !isShortcutTargetType(targetType);
    })
    .map((row) => {
      const targetType = String(row?._id?.targetType || '').trim().toLowerCase();
      const targetLabel = String(row?._id?.targetLabel || '').trim();

      return {
        key: `${row?._id?.businessId || 'global'}:${targetType}:${targetLabel || 'sem-rotulo'}`,
        label: targetLabel || humanizeToken(targetType) || 'Sem rotulo',
        targetType,
        count: row.count || 0,
        lastEventAt: row.lastEventAt || null,
        businessName: row.business?.name || '',
        businessSlug: row.business?.slug || '',
      };
    })
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, 'pt-BR'))
    .slice(0, limit);
}

export function buildUserAgentBreakdowns(rows = [], totalEvents = 0) {
  const deviceCounts = new Map();
  const browserCounts = new Map();
  const sourceTotal = rows.reduce((sum, row) => sum + (row.count || 0), 0) || totalEvents;

  rows.forEach((row) => {
    const count = row.count || 0;
    const userAgent = row._id || '';
    const deviceLabel = getDeviceLabel(userAgent);
    const browserLabel = getBrowserLabel(userAgent);

    deviceCounts.set(deviceLabel, (deviceCounts.get(deviceLabel) || 0) + count);
    browserCounts.set(browserLabel, (browserCounts.get(browserLabel) || 0) + count);
  });

  return {
    devices: buildBreakdown(
      [...deviceCounts.entries()].map(([label, count]) => ({ label, count })),
      sourceTotal,
    ),
    browsers: buildBreakdown(
      [...browserCounts.entries()].map(([label, count]) => ({ label, count })),
      sourceTotal,
    ),
  };
}

export function calculateActionRate(pageViews = 0, interactions = 0) {
  if (!pageViews) {
    return 0;
  }

  return Number(((interactions / pageViews) * 100).toFixed(1));
}

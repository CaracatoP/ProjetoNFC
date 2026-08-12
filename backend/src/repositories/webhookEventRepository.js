import { WebhookEvent } from '../models/WebhookEvent.js';

const WEBHOOK_PROCESSING_STALE_MS = 2 * 60 * 1000;

function isProcessingStale(record, now = new Date()) {
  if (!record || record.status !== 'processing') {
    return false;
  }

  const updatedAt = record.updatedAt || record.createdAt;
  const updatedAtMs = updatedAt ? new Date(updatedAt).getTime() : 0;

  return !updatedAtMs || now.getTime() - updatedAtMs > WEBHOOK_PROCESSING_STALE_MS;
}

async function resolveExistingWebhookEventRecord(record) {
  if (!record) {
    return {
      created: false,
      shouldProcess: false,
      record: null,
    };
  }

  if (['processed', 'ignored'].includes(record.status)) {
    return {
      created: false,
      shouldProcess: false,
      record,
    };
  }

  if (record.status === 'failed' || isProcessingStale(record)) {
    const acquired = await WebhookEvent.findOneAndUpdate(
      {
        _id: record._id,
        status: record.status,
        ...(record.status === 'processing'
          ? { updatedAt: { $lte: new Date(Date.now() - WEBHOOK_PROCESSING_STALE_MS) } }
          : {}),
      },
      {
        status: 'processing',
        errorCode: '',
        errorMessage: '',
        processedAt: null,
      },
      { new: true },
    );

    return {
      created: false,
      shouldProcess: Boolean(acquired),
      record: acquired || record,
    };
  }

  return {
    created: false,
    shouldProcess: false,
    record,
  };
}

export async function tryCreateWebhookEventRecord(payload) {
  try {
    const result = await WebhookEvent.findOneAndUpdate(
      {
        provider: payload.provider,
        eventId: payload.eventId,
      },
      {
        $setOnInsert: payload,
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
        setDefaultsOnInsert: true,
        includeResultMetadata: true,
      },
    );
    const record = result?.value || result;

    if (result?.lastErrorObject?.updatedExisting) {
      return resolveExistingWebhookEventRecord(record);
    }

    return {
      created: true,
      shouldProcess: true,
      record,
    };
  } catch (error) {
    if (error?.code === 11000) {
      const record = await WebhookEvent.findOne({
        provider: payload.provider,
        eventId: payload.eventId,
      });

      return resolveExistingWebhookEventRecord(record);
    }

    throw error;
  }
}

export function markWebhookEventProcessed(id, payload = {}) {
  return WebhookEvent.findByIdAndUpdate(
    id,
    {
      ...payload,
      status: 'processed',
      processedAt: new Date(),
      errorCode: '',
      errorMessage: '',
    },
    { new: true },
  );
}

export function markWebhookEventFailed(id, error) {
  return WebhookEvent.findByIdAndUpdate(
    id,
    {
      status: 'failed',
      processedAt: new Date(),
      errorCode: String(error?.code || 'webhook_processing_failed').trim(),
      errorMessage: String(error?.message || 'Falha ao processar webhook.').trim().slice(0, 500),
    },
    { new: true },
  );
}

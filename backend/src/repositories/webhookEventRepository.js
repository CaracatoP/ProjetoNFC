import { WebhookEvent } from '../models/WebhookEvent.js';

export async function tryCreateWebhookEventRecord(payload) {
  const existingRecord = await WebhookEvent.findOne({
    provider: payload.provider,
    eventId: payload.eventId,
  });

  if (existingRecord) {
    return {
      created: false,
      record: existingRecord,
    };
  }

  try {
    const record = await WebhookEvent.create(payload);

    return {
      created: true,
      record,
    };
  } catch (error) {
    if (error?.code === 11000) {
      return {
        created: false,
        record: await WebhookEvent.findOne({
          provider: payload.provider,
          eventId: payload.eventId,
        }),
      };
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

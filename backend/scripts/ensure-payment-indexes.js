import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { Payment } from '../src/models/Payment.js';
import { PaymentCustomer } from '../src/models/PaymentCustomer.js';
import { WebhookEvent } from '../src/models/WebhookEvent.js';
import { logger } from '../src/utils/logger.js';

const FINANCE_INDEX_MODELS = [
  Payment,
  PaymentCustomer,
  WebhookEvent,
];

async function ensurePaymentIndexes() {
  await connectDatabase();

  for (const model of FINANCE_INDEX_MODELS) {
    await model.createIndexes();
    logger.info(
      {
        model: model.modelName,
        indexes: model.schema.indexes().map(([fields, options]) => ({
          fields,
          unique: Boolean(options?.unique),
        })),
      },
      'Finance/payment indexes ensured',
    );
  }
}

ensurePaymentIndexes()
  .then(async () => {
    await disconnectDatabase();
  })
  .catch(async (error) => {
    logger.error({ err: error }, 'Failed to ensure finance/payment indexes');
    await disconnectDatabase().catch(() => {});
    process.exitCode = 1;
  });

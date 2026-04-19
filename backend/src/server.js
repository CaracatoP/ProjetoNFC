import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { bootstrapSystemData } from './services/systemBootstrapService.js';
import { logger } from './utils/logger.js';
import { seedDemoData } from './utils/seedDemoData.js';

async function bootstrap() {
  await connectDatabase();
  await bootstrapSystemData();

  if (env.enableDemoSeed) {
    await seedDemoData();
    logger.info('Demo seed enabled for this environment');
  }

  app.listen(env.port, '0.0.0.0', () => {
    logger.info(
      {
        port: env.port,
        demoSeed: env.enableDemoSeed,
      },
      'API started successfully',
    );
  });
}

bootstrap().catch((error) => {
  logger.error({ err: error }, 'Failed to start API');
  process.exit(1);
});

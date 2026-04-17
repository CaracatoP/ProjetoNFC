import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { seedDemoData } from './utils/seedDemoData.js';

async function bootstrap() {
  await connectDatabase();

  if (env.enableDemoSeed) {
    await seedDemoData();
  }

  app.listen(env.port, () => {
    console.log(`API rodando em http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Falha ao iniciar a API:', error);
  process.exit(1);
});


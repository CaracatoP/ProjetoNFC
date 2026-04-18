import app from './app.js';
import { connectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { seedDemoData } from './utils/seedDemoData.js';

async function bootstrap() {
  await connectDatabase();

  if (env.enableDemoSeed) {
    await seedDemoData();
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`API rodando na porta ${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('Falha ao iniciar a API:', error);
  process.exit(1);
});
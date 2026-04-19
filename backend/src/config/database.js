import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { logger } from '../utils/logger.js';
import { env } from './env.js';

mongoose.set('strictQuery', true);
let memoryServer = null;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(env.mongodbUri);
    logger.info('Connected to MongoDB');
    return mongoose.connection;
  } catch (error) {
    const canFallbackToMemory = env.nodeEnv !== 'production';

    if (!canFallbackToMemory) {
      throw error;
    }

    logger.warn({ err: error }, 'MongoDB unavailable. Falling back to in-memory database for development');

    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());
    logger.info('Connected to in-memory MongoDB');
    return mongoose.connection;
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) {
    if (memoryServer) {
      await memoryServer.stop();
      memoryServer = null;
    }
    return;
  }

  await mongoose.disconnect();
  logger.info('Disconnected from MongoDB');

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

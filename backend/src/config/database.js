import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './env.js';

mongoose.set('strictQuery', true);
let memoryServer = null;

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(env.mongodbUri);
    return mongoose.connection;
  } catch (error) {
    const canFallbackToMemory = env.nodeEnv !== 'production';

    if (!canFallbackToMemory) {
      throw error;
    }

    console.warn('Mongo local indisponível; iniciando Mongo em memória para desenvolvimento.');

    memoryServer = await MongoMemoryServer.create();
    await mongoose.connect(memoryServer.getUri());
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

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

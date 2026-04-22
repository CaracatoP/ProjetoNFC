import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  base: {
    service: 'taplink-api',
    env: env.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

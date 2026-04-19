import { env } from './env.js';

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.frontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} nao permitida pelo CORS`));
  },
  credentials: true,
};

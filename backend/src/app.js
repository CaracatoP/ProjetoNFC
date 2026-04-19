import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { corsOptions } from './config/cors.js';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { sanitizeInput } from './middlewares/sanitizeInput.js';
import routes from './routes/index.js';

const app = express();

app.set('trust proxy', env.trustProxy);
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeInput);
app.use(requestLogger);

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

export default app;

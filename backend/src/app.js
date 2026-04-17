import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { corsOptions } from './config/cors.js';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFound } from './middlewares/notFound.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { ensureUploadsDirectory, getUploadsDirectory } from './utils/storage.js';

const app = express();

app.set('trust proxy', true);
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '3mb' }));
app.use(requestLogger);
ensureUploadsDirectory();
app.use('/uploads', express.static(getUploadsDirectory()));

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

export default app;

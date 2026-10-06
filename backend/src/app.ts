import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { rateLimiter, strictRateLimiter } from './middlewares/rateLimit.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import comparisonsRoutes from './modules/comparisons/comparisons.routes.js';
import partnersRoutes from './modules/partners/partners.routes.js';
import periodsRoutes from './modules/periods/periods.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';

const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(rateLimiter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'portcont', timestamp: new Date().toISOString() });
});

app.use('/api/partners', partnersRoutes);
app.use('/api/periods', periodsRoutes);
app.use('/api/comparisons', strictRateLimiter, comparisonsRoutes);
app.use('/api/reports', reportsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
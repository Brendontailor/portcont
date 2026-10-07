import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimiter, strictRateLimiter } from './middlewares/rateLimit.middleware.js';
import { requireAuth } from './middlewares/auth.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import authRoutes from './modules/auth/auth.routes.js';
import comparisonsRoutes from './modules/comparisons/comparisons.routes.js';
import partnersRoutes from './modules/partners/partners.routes.js';
import periodsRoutes from './modules/periods/periods.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';

const app = express();

// Vercel/other reverse proxies forward the client IP. Express rate-limit expects
// the proxy to be trusted when X-Forwarded-For is present.
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = new Set([
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
].filter((value): value is string => Boolean(value)));

app.use(cors({
  origin(origin, callback) {
    // Requests without Origin are server-to-server/same-environment requests.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origem não permitida pelo CORS'));
  },
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

// Authentication endpoints stay public. Every business endpoint below this
// point requires a valid PortCont session.
app.use('/api/auth', authRoutes);
app.use('/api/partners', requireAuth, partnersRoutes);
app.use('/api/periods', requireAuth, periodsRoutes);
app.use('/api/comparisons', requireAuth, strictRateLimiter, comparisonsRoutes);
app.use('/api/reports', requireAuth, reportsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const rateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictRateLimiter = rateLimit({
  windowMs: 60000,
  max: 60,
  message: { error: 'Muitas tentativas. Aguarde um minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.' },
  standardHeaders: true,
  legacyHeaders: false,
});

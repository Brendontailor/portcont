import { Router } from 'express';
import { z, ZodError } from 'zod';
import { AUTH_COOKIE_NAME, AUTH_SESSION_SECONDS } from '../../../../lib/auth.js';
import { loginRateLimiter } from '../../middlewares/rateLimit.middleware.js';
import { requireAuth, type AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { authenticate, createSessionToken } from './auth.service.js';

const router = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: AUTH_SESSION_SECONDS * 1000,
  };
}

function logLoginFailure(stage: string, error: unknown, sensitiveInput: string[] = []) {
  const err = error instanceof Error ? error : new Error('Unknown authentication error');
  const metadata = err as Error & { code?: unknown; errorCode?: unknown };
  let message = err.message;

  for (const key of ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'ADMIN_PASSWORD']) {
    const secret = process.env[key];
    if (secret) message = message.split(secret).join('[REDACTED]');
  }
  for (const value of sensitiveInput) {
    if (value) message = message.split(value).join('[REDACTED]');
  }
  message = message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[DATABASE_URL]');

  const code = typeof metadata.code === 'string'
    ? metadata.code
    : typeof metadata.errorCode === 'string' ? metadata.errorCode : undefined;
  console.error('[AUTH LOGIN ERROR]', { stage, name: err.name, code, message });
}

router.post('/login', loginRateLimiter, async (req, res, next) => {
  let stage = 'validating request';
  const sensitiveInput: string[] = [];
  try {
    const { username, password } = loginSchema.parse(req.body);
    sensitiveInput.push(username, password);
    stage = 'looking up user and verifying password';
    const user = await authenticate(username, password);
    stage = 'signing session JWT';
    const token = await createSessionToken(user);

    stage = 'setting HttpOnly session cookie';
    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
    res.json({ authenticated: true, user });
  } catch (error) {
    if (error instanceof AppError || error instanceof ZodError) {
      next(error);
      return;
    }

    logLoginFailure(stage, error, sensitiveInput);
    res.status(500).json({ error: 'Não foi possível entrar no momento. Tente novamente.' });
  }
});

router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ authenticated: true, user: req.user });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.status(204).send();
});

export default router;

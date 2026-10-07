import { Router } from 'express';
import { z } from 'zod';
import { AUTH_COOKIE_NAME, AUTH_SESSION_SECONDS } from '../../../../lib/auth.js';
import { loginRateLimiter } from '../../middlewares/rateLimit.middleware.js';
import { requireAuth, type AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
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

router.post('/login', loginRateLimiter, async (req, res, next) => {
  try {
    const { username, password } = loginSchema.parse(req.body);
    const user = await authenticate(username, password);
    const token = await createSessionToken(user);

    res.cookie(AUTH_COOKIE_NAME, token, cookieOptions());
    res.json({ authenticated: true, user });
  } catch (error) {
    next(error);
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

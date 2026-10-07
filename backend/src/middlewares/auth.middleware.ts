import type { NextFunction, Request, Response } from 'express';
import { AUTH_COOKIE_NAME } from '../../../lib/auth.js';
import { verifySessionToken, type AuthUser } from '../modules/auth/auth.service.js';
import { AppError } from './error.middleware.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function getCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;

  for (const cookie of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName === name) {
      return decodeURIComponent(rawValue.join('='));
    }
  }

  return undefined;
}

export async function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const token = getCookieValue(req.headers.cookie, AUTH_COOKIE_NAME);
    if (!token) {
      throw new AppError(401, 'Autenticação necessária.');
    }

    req.user = await verifySessionToken(token);
    next();
  } catch (error) {
    next(error);
  }
}

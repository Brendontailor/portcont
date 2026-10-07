import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { AUTH_SESSION_SECONDS } from '../../../../lib/auth.js';

export interface AuthUser {
  id: string;
  username: string;
}

interface SessionPayload {
  sub: string;
  username: string;
  iat: number;
  exp: number;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new AppError(500, 'Autenticação não configurada no servidor');
  }
  return secret;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function signPart(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, expectedHex] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;

  try {
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function authenticate(username: string, password: string): Promise<AuthUser> {
  const normalizedUsername = username.trim();
  const user = await prisma.user.findUnique({ where: { username: normalizedUsername } });

  // Always perform a scrypt operation so missing users do not create an obvious
  // timing difference from wrong passwords.
  const fallbackHash = 'scrypt$0123456789abcdef0123456789abcdef$' + '00'.repeat(64);
  const passwordMatches = verifyPassword(password, user?.passwordHash ?? fallbackHash);

  if (!user || !user.active || !passwordMatches) {
    throw new AppError(401, 'Usuário ou senha inválidos.');
  }

  return { id: user.id, username: user.username };
}

export async function createSessionToken(user: AuthUser): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    sub: user.id,
    username: user.username,
    iat: now,
    exp: now + AUTH_SESSION_SECONDS,
  } satisfies SessionPayload));
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${signPart(unsigned, getJwtSecret())}`;
}

function verifySignedPayload(token: string): SessionPayload {
  const [headerPart, payloadPart, signaturePart] = token.split('.');
  if (!headerPart || !payloadPart || !signaturePart) {
    throw new Error('Malformed token');
  }

  const unsigned = `${headerPart}.${payloadPart}`;
  const expectedSignature = Buffer.from(signPart(unsigned, getJwtSecret()), 'utf8');
  const actualSignature = Buffer.from(signaturePart, 'utf8');
  if (expectedSignature.length !== actualSignature.length || !timingSafeEqual(expectedSignature, actualSignature)) {
    throw new Error('Invalid signature');
  }

  const header = JSON.parse(base64UrlDecode(headerPart).toString('utf8')) as { alg?: string };
  if (header.alg !== 'HS256') throw new Error('Invalid algorithm');

  const payload = JSON.parse(base64UrlDecode(payloadPart).toString('utf8')) as SessionPayload;
  const now = Math.floor(Date.now() / 1000);
  if (!payload.sub || !payload.username || !payload.exp || payload.exp <= now) {
    throw new Error('Expired or invalid token');
  }

  return payload;
}

export async function verifySessionToken(token: string): Promise<AuthUser> {
  try {
    const payload = verifySignedPayload(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true, active: true },
    });

    if (!user || !user.active || user.username !== payload.username) {
      throw new Error('Inactive or missing user');
    }

    return { id: user.id, username: user.username };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(401, 'Sessão inválida ou expirada.');
  }
}

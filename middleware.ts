import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from './lib/auth';

const publicPaths = ['/login'];

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function verifyHmac(unsigned: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned));
  const expected = new Uint8Array(signed);
  const actual = fromBase64Url(signature);

  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index++) diff |= expected[index] ^ actual[index];
  return diff === 0;
}

async function isValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const secret = process.env.JWT_SECRET;
  if (!token || !secret || secret.length < 32) return false;

  try {
    const [headerPart, payloadPart, signaturePart] = token.split('.');
    if (!headerPart || !payloadPart || !signaturePart) return false;

    const unsigned = `${headerPart}.${payloadPart}`;
    if (!(await verifyHmac(unsigned, signaturePart, secret))) return false;

    const header = JSON.parse(new TextDecoder().decode(fromBase64Url(headerPart))) as { alg?: string };
    if (header.alg !== 'HS256') return false;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart))) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublicPath = publicPaths.includes(pathname);
  const authenticated = await isValidSession(request);

  if (isPublicPath) {
    if (authenticated) return NextResponse.redirect(new URL('/', request.url));
    return NextResponse.next();
  }

  if (!authenticated) {
    const loginUrl = new URL('/login', request.url);
    const nextPath = `${pathname}${search}`;
    if (nextPath !== '/') loginUrl.searchParams.set('next', nextPath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|images/).*)'],
};

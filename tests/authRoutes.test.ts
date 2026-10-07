import { createServer, type Server } from 'node:http';
import express from 'express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/src/lib/prisma.js', () => ({ prisma: { user: { findUnique: vi.fn() } } }));

import { prisma } from '../backend/src/lib/prisma.js';
import { errorHandler } from '../backend/src/middlewares/error.middleware.js';
import { requireAuth } from '../backend/src/middlewares/auth.middleware.js';
import authRoutes from '../backend/src/modules/auth/auth.routes.js';
import { hashPassword } from '../backend/src/modules/auth/auth.service.js';

const password = 'Senha-forte-para-teste-123';
const testUser = {
  id: 'user-test-1',
  username: 'admin',
  passwordHash: hashPassword(password),
  active: true,
};

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.get('/api/protected-test', requireAuth, (_req, res) => res.json({ protected: true }));
app.use(errorHandler);

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
  vi.stubEnv('NODE_ENV', 'test');
  vi.mocked(prisma.user.findUnique).mockResolvedValue(testUser as never);
});

afterEach(() => vi.unstubAllEnvs());

describe('rotas de autenticação', () => {
  it('autentica credenciais válidas, define cookie HttpOnly e mantém sessão em /me', async () => {
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password }),
    });

    expect(login.status).toBe(200);
    const setCookie = login.headers.get('set-cookie') || '';
    expect(setCookie).toContain('portcont_session=');
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie).toContain('Path=/');

    const sessionCookie = setCookie.split(';')[0];
    const me = await fetch(`${baseUrl}/api/auth/me`, { headers: { cookie: sessionCookie } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ authenticated: true, user: { id: testUser.id, username: testUser.username } });
  });

  it('usa Secure no cookie em produção', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const login = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password }),
    });
    expect(login.status).toBe(200);
    expect((login.headers.get('set-cookie') || '').toLowerCase()).toContain('secure');
  });

  it('retorna 401 para senha incorreta e usuário inexistente', async () => {
    const wrongPassword = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'senha-incorreta' }),
    });
    expect(wrongPassword.status).toBe(401);

    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null as never);
    const missingUser = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'inexistente', password }),
    });
    expect(missingUser.status).toBe(401);
  });

  it('retorna 400 para campos ausentes', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });

  it('registra falha de banco com etapa segura e responde sem detalhes internos', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const databaseUrl = 'postgresql://user:password@database.example/db';
    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error(`Can't reach ${databaseUrl}; password=${password}`));

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Não foi possível entrar no momento. Tente novamente.' });
    expect(log).toHaveBeenCalledWith('[AUTH LOGIN ERROR]', expect.objectContaining({
      stage: 'looking up user and verifying password',
    }));
    expect(JSON.stringify(log.mock.calls)).not.toContain('database.example');
    expect(JSON.stringify(log.mock.calls)).not.toContain(password);
    log.mockRestore();
  });

  it('limpa o cookie ao sair e continua protegendo rotas sem sessão', async () => {
    const logout = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
    expect(logout.status).toBe(204);
    const clearedCookie = (logout.headers.get('set-cookie') || '').toLowerCase();
    expect(clearedCookie).toContain('portcont_session=');
    expect(clearedCookie).toContain('expires=thu, 01 jan 1970');

    const protectedResponse = await fetch(`${baseUrl}/api/protected-test`);
    expect(protectedResponse.status).toBe(401);
  });
});

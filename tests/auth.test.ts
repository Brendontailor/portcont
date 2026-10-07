import { describe, expect, it } from 'vitest';
import { AppError } from '../backend/src/middlewares/error.middleware';
import { createSessionToken, hashPassword, verifyPassword } from '../backend/src/modules/auth/auth.service';
import { getLoginRedirectPath } from '../lib/auth';

describe('autenticação', () => {
  it('gera hash scrypt e valida somente a senha correta', () => {
    const hash = hashPassword('Senha-Forte-123');

    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain('Senha-Forte-123');
    expect(verifyPassword('Senha-Forte-123', hash)).toBe(true);
    expect(verifyPassword('senha-errada', hash)).toBe(false);
  });

  it('gera token de sessão assinado no formato JWT', async () => {
    const token = await createSessionToken({ id: 'user-1', username: 'admin' });
    expect(token.split('.')).toHaveLength(3);
  });

  it('falha explicitamente e sem expor o secret quando JWT_SECRET está ausente', async () => {
    const previous = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      await expect(createSessionToken({ id: 'user-1', username: 'admin' }))
        .rejects.toMatchObject({ statusCode: 500, message: 'Autenticação não configurada no servidor' });
    } finally {
      if (previous === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previous;
    }
  });

  it('redireciona após login para a rota solicitada e rejeita destinos externos', () => {
    expect(getLoginRedirectPath('/')).toBe('/');
    expect(getLoginRedirectPath('/historico?periodId=abc')).toBe('/historico?periodId=abc');
    expect(getLoginRedirectPath('//attacker.example')).toBe('/');
    expect(getLoginRedirectPath('https://attacker.example')).toBe('/');
    expect(getLoginRedirectPath(null)).toBe('/');
  });
});

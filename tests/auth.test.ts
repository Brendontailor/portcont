import { describe, expect, it } from 'vitest';
import { createSessionToken, hashPassword, verifyPassword } from '../backend/src/modules/auth/auth.service';

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
});

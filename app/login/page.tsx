'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getLoginRedirectPath } from '@/lib/auth';
import { api, ApiError } from '@/services/api';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      await api.auth.login(username, password);
      const params = new URLSearchParams(window.location.search);
      router.replace(getLoginRedirectPath(params.get('next')));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setError('Informe seu usuário e sua senha.');
      } else if (err instanceof ApiError && err.status === 401) {
        setError('Usuário ou senha inválidos.');
      } else if (err instanceof ApiError && err.status >= 500) {
        setError('Não foi possível entrar no momento. Tente novamente.');
      } else {
        setError(err instanceof Error ? err.message : 'Não foi possível entrar no PortCont.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="login-title">
        <div className={styles.brandPanel}>
          <div className={styles.brandCopy}>
            <span className={styles.eyebrow}>PORTCONT</span>
            <h1 className={styles.brandTitle}>Comparação inteligente de clientes</h1>
            <p className={styles.brandText}>
              Acesse o ambiente interno para comparar bases, consultar parceiras e gerar relatórios.
            </p>
          </div>
          <Image
            src="/images/portcont/portcont-hero-comparacao.png"
            alt="Ilustração de comparação de bases do PortCont"
            width={520}
            height={390}
            priority
            className={styles.illustration}
          />
        </div>

        <div className={styles.loginPanel}>
          <div className={styles.loginHeader}>
            <span className={styles.mobileBrand}>PORTCONT</span>
            <h2 id="login-title">Entrar</h2>
            <p>Use o usuário e a senha autorizados para acessar o sistema.</p>
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}

          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span>Usuário</span>
              <input
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                disabled={loading}
                autoFocus
              />
            </label>

            <label className={styles.field}>
              <span>Senha</span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={loading}
              />
            </label>

            <button className={styles.submitButton} type="submit" disabled={loading || !username.trim() || !password}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className={styles.securityNote}>A sessão é protegida por cookie HttpOnly e expira automaticamente.</p>
        </div>
      </section>
    </main>
  );
}

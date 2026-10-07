'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/services/api';
import styles from './Header.module.css';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const navItems = [
    { href: '/', label: 'Comparar' },
    { href: '/historico', label: 'Histórico' },
    { href: '/parceiras', label: 'Parceiras' },
  ];

  useEffect(() => {
    let cancelled = false;
    api.auth.me()
      .then(({ user: currentUser }) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api.auth.logout();
    } finally {
      router.replace('/login');
      router.refresh();
      setLoggingOut(false);
    }
  };

  return (
    <header className={styles.header} role="banner">
      <div className={styles.container}>
        <Link href="/" className={styles.logo} aria-label="PORTCONT - Página inicial">
          <span className={styles.logoText}>PORTCONT</span>
          <span className={styles.logoSubtitle}>Comparação inteligente de clientes</span>
        </Link>

        <div className={styles.rightArea}>
          <nav className={styles.nav} aria-label="Navegação principal">
            <ul className={styles.navList}>
              {navItems.map(item => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`${styles.navLink} ${pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? styles.active : ''}`}
                    aria-current={pathname === item.href ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.account}>
            {user && <span className={styles.username} title={user.username}>{user.username}</span>}
            <button className={styles.logoutButton} type="button" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Saindo...' : 'Sair'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

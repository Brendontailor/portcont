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
              {navItems.map((item, index) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`${styles.navLink} ${pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? styles.active : ''}`}
                    aria-current={pathname === item.href ? 'page' : undefined}
                  >
                    <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {index === 0 ? <><path d="M4 5h16v14H4z"/><path d="M8 9h3M8 13h8M8 16h5M15 8l2 2 3-4"/></> : index === 1 ? <><path d="M4 5h16v15H4z"/><path d="M8 3v4M16 3v4M4 9h16M8 13h3M8 16h7"/></> : <><path d="M3 20h18M5 20V8l7-4 7 4v12"/><path d="M9 20v-6h6v6M8 10h.01M16 10h.01"/></>}
                    </svg>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.account}>
            {user && <span className={styles.username} title={user.username}>{user.username}</span>}
            <button className={styles.logoutButton} type="button" onClick={handleLogout} disabled={loggingOut}>
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>
              <span>{loggingOut ? 'Saindo...' : 'Sair'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

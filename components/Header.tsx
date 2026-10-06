'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';

export default function Header() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Comparar' },
    { href: '/historico', label: 'Histórico' },
    { href: '/parceiras', label: 'Parceiras' },
  ];

  return (
    <header className={styles.header} role="banner">
      <div className={styles.container}>
        <Link href="/" className={styles.logo} aria-label="PORTCONT - Página inicial">
          <span className={styles.logoText}>PORTCONT</span>
          <span className={styles.logoSubtitle}>Comparação inteligente de clientes</span>
        </Link>
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
      </div>
    </header>
  );
}
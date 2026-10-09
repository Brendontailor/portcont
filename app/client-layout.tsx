'use client';

import { ReactNode, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';

export default function ClientLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const showHeader = pathname !== '/login';

  return (
    <>
      {showHeader && <Header />}
      <main id="main-content">
        <Suspense fallback={null}>{children}</Suspense>
      </main>
    </>
  );
}
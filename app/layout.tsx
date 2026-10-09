import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'PORTCONT - Comparação inteligente de clientes',
  description: 'Compare duas bases de clientes e encontre diferenças automaticamente, mesmo quando os nomes possuem pequenas divergências de escrita.',
  icons: {
    icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/images/portcont/portcont-mark.svg', type: 'image/svg+xml' }],
    shortcut: '/favicon.ico',
    apple: '/images/portcont/apple-touch-icon.png',
  },
};

import ClientLayout from './client-layout';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
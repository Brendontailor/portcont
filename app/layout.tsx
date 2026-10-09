import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'PORTCONT - Comparação inteligente de clientes',
  description: 'Compare duas bases de clientes e encontre diferenças automaticamente, mesmo quando os nomes possuem pequenas divergências de escrita.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <head>
        <link rel="icon" href="/images/portcont/logo.png" sizes="any" />
        <link rel="apple-touch-icon" href="/images/portcont/logo.png" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
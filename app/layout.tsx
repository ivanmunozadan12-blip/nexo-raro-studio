import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexo Raro Studio',
  description: 'Centro de producción y control de Nexo Raro.',
  manifest: '/manifest.webmanifest',
  themeColor: '#0b1218',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}

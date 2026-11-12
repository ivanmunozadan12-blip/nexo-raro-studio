import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Behind del Mundo Studio',
  description: 'Centro de producción y control de Behind del Mundo.',
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { themeColor: '#0b1218' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}

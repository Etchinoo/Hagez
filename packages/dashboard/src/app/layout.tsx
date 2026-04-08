// ============================================================
// SUPER RESERVATION PLATFORM — Dashboard Root Layout
// RTL sidebar on RIGHT side. Arabic-first labels.
// Tablet-optimised (1024px primary breakpoint).
// Cairo (Arabic) + Inter (Latin) typefaces.
// ============================================================

import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'لوحة التحكم | Hagez',
  description: 'إدارة حجوزاتك وتوافرك وإيراداتك',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.png', shortcut: '/favicon.png' },
};

export const viewport: Viewport = {
  themeColor: '#0F2044',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <style dangerouslySetInnerHTML={{ __html: `
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: 'Cairo', 'Inter', sans-serif;
            background-color: #F7F8FA;
            color: #0F2044;
            direction: rtl;
          }
          :root {
            --navy: #0F2044;
            --teal: #1B8A7A;
            --cta: #0057FF;
            --surface: #FFFFFF;
            --border: #E5E7EB;
            --text-secondary: #6B7280;
            --sidebar-width: 260px;
          }
        ` }} />
      </head>
      <body><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}

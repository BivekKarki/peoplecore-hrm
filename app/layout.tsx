import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'PeopleCore HRM', template: '%s | PeopleCore HRM' },
  description: 'Enterprise HR Management System',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          height: '100%',
          margin: 0,
          padding: 0,
          backgroundColor: '#0f1724',
          color: '#f1f5f9',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        {children}
      </body>
    </html>
  );
}

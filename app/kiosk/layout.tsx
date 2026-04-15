import { ToastProvider } from '@/components/ui';

// Kiosk runs fullscreen with no sidebar or topbar
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100vh', overflow: 'hidden', backgroundColor: '#0a0f1a' }}>
      {children}
      <ToastProvider />
    </div>
  );
}

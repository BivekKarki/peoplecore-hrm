import { Sidebar } from '@/components/layout/Sidebar';
import { ToastProvider } from '@/components/ui';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: '#0f1724' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {children}
      </div>
      <ToastProvider />
    </div>
  );
}

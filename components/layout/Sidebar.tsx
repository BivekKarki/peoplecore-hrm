'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, ClipboardList, FileText,
  Clock, Calendar, DollarSign, BarChart2,
  Eye, PieChart, Settings, LogOut, ChevronLeft, Menu,
  Camera, CalendarDays, FolderOpen, Receipt, TrendingUp,
  Bot, Radio, Shield, GraduationCap,
} from 'lucide-react';
import { showToast } from '@/components/ui';

const NAV = [
  { label: 'Overview', items: [
    { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/analytics',  icon: TrendingUp,      label: 'Analytics' },
    { href: '/realtime',   icon: Radio,           label: 'Live Monitor' },
  ]},
  { label: 'Employees', items: [
    { href: '/employees',    icon: Users,         label: 'All Employees' },
    { href: '/induction',    icon: ClipboardList, label: 'Induction' },
    { href: '/registration', icon: FileText,      label: 'Registration' },
    { href: '/documents',    icon: FolderOpen,    label: 'Documents' },
  ]},
  { label: 'Operations', items: [
    { href: '/schedule',     icon: CalendarDays,  label: 'Schedule' },
    { href: '/attendance',   icon: Clock,         label: 'Attendance' },
    { href: '/leave',        icon: Calendar,      label: 'Leave' },
    { href: '/payroll',      icon: DollarSign,    label: 'Payroll' },
    { href: '/expenses',     icon: Receipt,       label: 'Expenses' },
    { href: '/performance',  icon: BarChart2,     label: 'Performance' },
    { href: '/training',     icon: GraduationCap, label: 'Training' },
  ]},
  { label: 'Intelligence', items: [
    { href: '/ai',      icon: Bot,     label: 'AI Hub', badge: 'AI' },
    { href: '/reports', icon: PieChart, label: 'Reports' },
  ]},
  { label: 'Access', items: [
    { href: '/facial',   icon: Eye,     label: 'Facial Login' },
    { href: '/kiosk',    icon: Camera,  label: 'Kiosk' },
    { href: '/users',    icon: Shield,  label: 'Users & Roles' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ]},
];

export function Sidebar() {
  const pathname    = usePathname();
  const router      = useRouter();
  const [col, setCol]      = useState(false);
  const [mob, setMob]      = useState(false);

  const logout = async () => {
    try { await fetch('/api/auth', { method: 'DELETE' }); router.push('/login'); }
    catch { showToast('Logout failed', 'error'); }
  };

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const sidebarStyle: React.CSSProperties = {
    display:        'flex',
    flexDirection:  'column',
    height:         '100%',
    backgroundColor:'#162030',
    borderRight:    '1px solid #2a3a52',
    width:          col ? 60 : 220,
    transition:     'width 0.2s ease',
    flexShrink:     0,
    overflowX:      'hidden',
  };

  const inner = (
    <div style={sidebarStyle}>
      {/* Logo */}
      <div style={{ padding: '16px 12px', borderBottom: '1px solid #2a3a52', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, background: '#2563eb', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>P</div>
          {!col && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>PeopleCore</div>
              <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>HR Suite v5</div>
            </div>
          )}
        </div>
        <button onClick={() => setCol(!col)} style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 6 }} className="hidden md:flex">
          {col ? <Menu size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        {NAV.map(section => (
          <div key={section.label} style={{ marginBottom: 16 }}>
            {!col && (
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#334155', fontFamily: 'monospace', padding: '0 8px', marginBottom: 6 }}>
                {section.label}
              </div>
            )}
            {section.items.map(item => {
              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={() => setMob(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderRadius: 8, marginBottom: 2, textDecoration: 'none', fontSize: 13,
                    color: active ? '#ffffff' : '#94a3b8',
                    backgroundColor: active ? '#2563eb' : 'transparent',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = '#1e2d42'; (e.currentTarget as HTMLElement).style.color = '#f1f5f9'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                >
                  <item.icon size={16} style={{ flexShrink: 0 }} />
                  {!col && <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
                  {!col && item.badge && (
                    <span style={{ fontSize: 9, fontFamily: 'monospace', padding: '2px 6px', borderRadius: 20, background: item.badge === 'AI' ? '#7c3aed' : '#dc2626', color: 'white' }}>{item.badge}</span>
                  )}
                  {col && item.badge && (
                    <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#dc2626' }} />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid #2a3a52' }}>
        {!col ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: '#1e2d42' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: 'white', flexShrink: 0 }}>AD</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Admin User</div>
              <div style={{ fontSize: 10, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>HR Director</div>
            </div>
            <button onClick={logout} style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#475569'}>
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button onClick={logout} style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: 8, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#475569'}>
            <LogOut size={16} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex" style={{ height: '100vh', position: 'sticky', top: 0 }}>{inner}</div>

      {/* Mobile toggle */}
      <button className="md:hidden" onClick={() => setMob(!mob)}
        style={{ position: 'fixed', top: 12, left: 12, zIndex: 50, background: '#162030', border: '1px solid #2a3a52', borderRadius: 8, padding: 8, color: '#94a3b8', display: 'flex', cursor: 'pointer' }}>
        <Menu size={18} />
      </button>

      {/* Mobile drawer */}
      {mob && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex' }} className="md:hidden">
          <div style={{ display: 'flex', height: '100%' }}>{inner}</div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.6)' }} onClick={() => setMob(false)} />
        </div>
      )}
    </>
  );
}

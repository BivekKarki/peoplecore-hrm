'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, ClipboardList, FileText,
  Clock, Calendar, DollarSign, BarChart2,
  Eye, PieChart, Settings, LogOut, X, Menu,
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
      { href: '/ai',      icon: Bot,      label: 'AI Hub', badge: 'AI' },
      { href: '/reports', icon: PieChart, label: 'Reports' },
    ]},
  { label: 'Access', items: [
      { href: '/facial',   icon: Eye,      label: 'Facial Login' },
      { href: '/kiosk',    icon: Camera,   label: 'Kiosk' },
      { href: '/users',    icon: Shield,   label: 'Users & Roles' },
      { href: '/settings', icon: Settings, label: 'Settings' },
    ]},
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [isMobile, setIsMobile]       = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen]   = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = 'hidden';
    else            document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const logout = async () => {
    try { await fetch('/api/auth', { method: 'DELETE' }); router.push('/login'); }
    catch { showToast('Logout failed', 'error'); }
  };

  const isActive = (href: string) =>
      href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const toggle = () => {
    if (isMobile) setMobileOpen(p => !p);
    else          setDesktopOpen(p => !p);
  };

  const showFull      = (!isMobile && desktopOpen) || (isMobile && mobileOpen);
  const showCollapsed = !isMobile && !desktopOpen;
  const hidden        = isMobile && !mobileOpen;
  const sidebarWidth  = showFull ? 240 : 64;

  return (
      <>
        {/* Floating toggle button */}
        <button
            onClick={toggle}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            style={{
              position: 'fixed',
              top: 12,
              left: isMobile
                  ? (mobileOpen ? 240 + 12 : 12)
                  : (desktopOpen ? 240 + 12 : 64 + 12),
              zIndex: 60,
              width: 36, height: 36,
              background: '#162030',
              border: '1px solid #2a3a52',
              borderRadius: 8,
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'left 0.2s ease, background 0.15s',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#1e2d42'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#162030'}
        >
          {(isMobile && mobileOpen) || (!isMobile && desktopOpen)
              ? <X size={18} />
              : <Menu size={18} />}
        </button>

        {/* Mobile backdrop */}
        {isMobile && mobileOpen && (
            <div
                onClick={() => setMobileOpen(false)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 40,
                  background: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(2px)',
                }}
            />
        )}

        {/* Sidebar */}
        <aside
            style={{
              position: isMobile ? 'fixed' : 'sticky',
              top: 0,
              left: 0,
              height: '100vh',
              width: hidden ? 0 : sidebarWidth,
              backgroundColor: '#162030',
              borderRight: hidden ? 'none' : '1px solid #2a3a52',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              overflow: 'hidden',
              zIndex: 50,
              transition: 'width 0.2s ease, border 0.2s',
              boxShadow: isMobile && mobileOpen ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
            }}
        >
          {/* Logo */}
          <div style={{
            padding: '16px 12px',
            borderBottom: '1px solid #2a3a52',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            minHeight: 64,
          }}>
            <div style={{
              width: 36, height: 36,
              background: '#2563eb',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 16,
              flexShrink: 0,
            }}>P</div>
            {showFull && (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap' }}>PeopleCore</div>
                  <div style={{ fontSize: 9, color: '#475569', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>HR Suite</div>
                </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 8px' }}>
            {NAV.map(section => (
                <div key={section.label} style={{ marginBottom: 16 }}>
                  {showFull && (
                      <div style={{
                        fontSize: 9,
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        color: '#334155',
                        fontFamily: 'monospace',
                        padding: '0 8px',
                        marginBottom: 6,
                      }}>
                        {section.label}
                      </div>
                  )}
                  {section.items.map(item => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={showCollapsed ? item.label : undefined}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: showCollapsed ? '10px' : '8px 10px',
                              justifyContent: showCollapsed ? 'center' : 'flex-start',
                              borderRadius: 8,
                              marginBottom: 2,
                              textDecoration: 'none',
                              fontSize: 13,
                              color: active ? '#ffffff' : '#94a3b8',
                              backgroundColor: active ? '#2563eb' : 'transparent',
                              position: 'relative',
                              transition: 'background 0.15s, color 0.15s',
                            }}
                            onMouseEnter={e => {
                              if (!active) {
                                (e.currentTarget as HTMLElement).style.backgroundColor = '#1e2d42';
                                (e.currentTarget as HTMLElement).style.color = '#f1f5f9';
                              }
                            }}
                            onMouseLeave={e => {
                              if (!active) {
                                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                                (e.currentTarget as HTMLElement).style.color = '#94a3b8';
                              }
                            }}
                        >
                          <item.icon size={16} style={{ flexShrink: 0 }} />
                          {showFull && (
                              <span style={{
                                flex: 1,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                        {item.label}
                      </span>
                          )}
                          {showFull && item.badge && (
                              <span style={{
                                fontSize: 9,
                                fontFamily: 'monospace',
                                padding: '2px 6px',
                                borderRadius: 20,
                                background: item.badge === 'AI' ? '#7c3aed' : '#dc2626',
                                color: 'white',
                              }}>
                        {item.badge}
                      </span>
                          )}
                          {showCollapsed && item.badge && (
                              <span style={{
                                position: 'absolute',
                                top: 4, right: 4,
                                width: 7, height: 7,
                                borderRadius: '50%',
                                background: item.badge === 'AI' ? '#7c3aed' : '#dc2626',
                              }} />
                          )}
                        </Link>
                    );
                  })}
                </div>
            ))}
          </nav>

          {/* User */}
          <div style={{ padding: '12px 8px', borderTop: '1px solid #2a3a52' }}>
            {showFull ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: '#1e2d42',
                }}>
                  <div style={{
                    width: 30, height: 30,
                    borderRadius: '50%',
                    background: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'white',
                    flexShrink: 0,
                  }}>AD</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Admin User</div>
                    <div style={{ fontSize: 10, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>HR Director</div>
                  </div>
                  <button
                      onClick={logout}
                      title="Logout"
                      style={{
                        color: '#475569',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 6,
                        display: 'flex',
                        borderRadius: 6,
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#475569'}
                  >
                    <LogOut size={14} />
                  </button>
                </div>
            ) : (
                <button
                    onClick={logout}
                    title="Logout"
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                      padding: 10,
                      color: '#475569',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 8,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.color = '#f87171';
                      (e.currentTarget as HTMLElement).style.background = '#1e2d42';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.color = '#475569';
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                >
                  <LogOut size={16} />
                </button>
            )}
          </div>
        </aside>
      </>
  );
}
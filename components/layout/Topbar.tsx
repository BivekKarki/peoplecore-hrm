'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell } from 'lucide-react';
import { showToast } from '@/components/ui';

interface TopbarProps { title: string; action?: React.ReactNode; }

export function Topbar({ title, action }: TopbarProps) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [notif,  setNotif]  = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); }
        };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (search.trim()) router.push(`/employees?search=${encodeURIComponent(search.trim())}`);
    };

    return (
        <div style={{
            height: 60,
            borderBottom: '1px solid #2a3a52',
            backgroundColor: '#162030',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px 0 60px',
            gap: 12,
            flexShrink: 0,
        }}>
            <h1 className="topbar-title" style={{
                fontSize: 15,
                fontWeight: 600,
                color: '#f1f5f9',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
            }}>
                {title}
            </h1>

            <form
                onSubmit={handleSearch}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: '#1e2d42',
                    border: '1px solid #2a3a52',
                    borderRadius: 8,
                    padding: '6px 12px',
                    flex: 1,
                    maxWidth: 320,
                    marginLeft: 'auto',
                    transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = '#2563eb'}
                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = '#2a3a52'}
            >
                <Search size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                <input
                    ref={inputRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search... (Ctrl+K)"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f1f5f9',
                        fontSize: 13,
                        outline: 'none',
                        flex: 1,
                        minWidth: 0,
                    }}
                />
            </form>

            <button
                onClick={() => { setNotif(false); showToast('No new notifications', 'info'); }}
                title="Notifications"
                style={{
                    position: 'relative',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    padding: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    flexShrink: 0,
                    borderRadius: 6,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#94a3b8'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#64748b'}
            >
                <Bell size={16} />
                {notif && (
                    <span style={{
                        position: 'absolute',
                        top: 4, right: 4,
                        width: 6, height: 6,
                        borderRadius: '50%',
                        background: '#dc2626',
                    }} />
                )}
            </button>

            {action && <div style={{ flexShrink: 0 }}>{action}</div>}

            <style>{`
        @media (max-width: 600px) {
          .topbar-title {
            display: none;
          }
        }
      `}</style>
        </div>
    );
}
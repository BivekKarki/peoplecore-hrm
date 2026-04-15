'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Bell } from 'lucide-react';
import { showToast } from '@/components/ui';

interface TopbarProps { title: string; action?: React.ReactNode; }

export function Topbar({ title, action }: TopbarProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/employees?search=${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div className="h-14 border-b border-[#2a3a52] bg-[#162030] flex items-center px-4 md:px-6 gap-3 flex-shrink-0">
      {/* Spacer for mobile menu button */}
      <div className="w-8 md:hidden" />

      <h1 className="text-sm font-semibold text-slate-100 hidden md:block">{title}</h1>

      <form onSubmit={handleSearch} className="flex items-center gap-2 bg-[#1e2d42] border border-[#2a3a52] rounded-lg px-3 py-1.5 flex-1 max-w-xs ml-auto md:ml-0">
        <Search size={13} className="text-slate-500 flex-shrink-0" />
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          type="text"
          placeholder="Search employees… (Ctrl+K)"
          className="bg-transparent border-none text-sm text-slate-100 placeholder-slate-600 outline-none flex-1 min-w-0"
          autoComplete="off"
        />
      </form>

      <button
        onClick={() => showToast('No new notifications', 'info')}
        className="relative p-2 text-slate-400 hover:text-slate-100 hover:bg-[#1e2d42] rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
      </button>

      {action}
    </div>
  );
}

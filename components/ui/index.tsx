'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

// ─── BADGE ───────────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  active:          'bg-green-900/60 text-green-300 border border-green-700/40',
  inactive:        'bg-red-900/60 text-red-300 border border-red-700/40',
  pending:         'bg-yellow-900/60 text-yellow-300 border border-yellow-700/40',
  on_leave:        'bg-purple-900/60 text-purple-300 border border-purple-700/40',
  approved:        'bg-green-900/60 text-green-300 border border-green-700/40',
  denied:          'bg-red-900/60 text-red-300 border border-red-700/40',
  cancelled:       'bg-slate-800 text-slate-400 border border-slate-700/40',
  processed:       'bg-blue-900/60 text-blue-300 border border-blue-700/40',
  paid:            'bg-teal-900/60 text-teal-300 border border-teal-700/40',
  draft:           'bg-slate-800 text-slate-400 border border-slate-700/40',
  present:         'bg-green-900/60 text-green-300 border border-green-700/40',
  absent:          'bg-red-900/60 text-red-300 border border-red-700/40',
  late:            'bg-yellow-900/60 text-yellow-300 border border-yellow-700/40',
  half_day:        'bg-orange-900/60 text-orange-300 border border-orange-700/40',
  work_from_home:  'bg-blue-900/60 text-blue-300 border border-blue-700/40',
  completed:       'bg-green-900/60 text-green-300 border border-green-700/40',
  in_progress:     'bg-blue-900/60 text-blue-300 border border-blue-700/40',
  not_started:     'bg-slate-800 text-slate-400 border border-slate-700/40',
  'full-time':     'bg-blue-900/60 text-blue-300 border border-blue-700/40',
  'part-time':     'bg-purple-900/60 text-purple-300 border border-purple-700/40',
  contract:        'bg-amber-900/60 text-amber-300 border border-amber-700/40',
  casual:          'bg-teal-900/60 text-teal-300 border border-teal-700/40',
};

interface BadgeProps { status: string; label?: string; className?: string; }
export function Badge({ status, label, className = '' }: BadgeProps) {
  const style = STATUS_STYLES[status] ?? 'bg-slate-800 text-slate-400 border border-slate-700/40';
  const text = label ?? status.replace(/_/g, ' ');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-mono ${style} ${className}`}>
      {text}
    </span>
  );
}

// ─── BUTTON ──────────────────────────────────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}
export function Button({ variant = 'ghost', size = 'md', loading, children, className = '', disabled, ...props }: ButtonProps) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg cursor-pointer border transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
    ghost:   'bg-transparent text-slate-300 border-[#2a3a52] hover:bg-[#1e2d42] hover:text-white',
    success: 'bg-green-700 text-white border-green-700 hover:bg-green-800',
    danger:  'bg-red-700 text-white border-red-700 hover:bg-red-800',
  };
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3 py-2 text-sm', lg: 'px-4 py-2.5 text-sm' };
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

// ─── CARD ────────────────────────────────────────────────────────────────────
export function Card({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
      <div
          className={className}
          style={{ backgroundColor: '#162030', border: '1px solid #2a3a52', borderRadius: 12, ...style }}
      >
        {children}
      </div>
  );
}

// ─── INPUT ───────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string; }
export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs uppercase tracking-wider text-slate-400 font-mono">{label}</label>}
      <input
        className={`bg-[#1e2d42] border rounded-lg text-slate-100 px-3 py-2 text-sm placeholder-slate-500 transition-colors w-full focus:outline-none ${error ? 'border-red-500 focus:border-red-400' : 'border-[#2a3a52] focus:border-blue-500'} ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

// ─── SELECT ──────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> { label?: string; error?: string; }
export function Select({ label, error, className = '', children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs uppercase tracking-wider text-slate-400 font-mono">{label}</label>}
      <select
        className={`bg-[#1e2d42] border rounded-lg text-slate-100 px-3 py-2 text-sm transition-colors w-full focus:outline-none appearance-none cursor-pointer ${error ? 'border-red-500' : 'border-[#2a3a52] focus:border-blue-500'} ${className}`}
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%2364748b' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', paddingRight: '2.5rem' }}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

// ─── TEXTAREA ────────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; }
export function Textarea({ label, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs uppercase tracking-wider text-slate-400 font-mono">{label}</label>}
      <textarea
        className={`bg-[#1e2d42] border border-[#2a3a52] rounded-lg text-slate-100 px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors w-full resize-y min-h-[80px] ${className}`}
        {...props}
      />
    </div>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────
interface ModalProps { open: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidth?: string; }
export function Modal({ open, onClose, title, children, maxWidth = 'max-w-2xl' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`bg-[#162030] border border-[#2a3a52] rounded-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3a52]">
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1e2d42]"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── SPINNER ─────────────────────────────────────────────────────────────────
export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={`animate-spin text-blue-400 ${className}`} width={size} height={size} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── AVATAR ──────────────────────────────────────────────────────────────────
interface AvatarProps { firstName: string; lastName: string; color?: string; size?: number; }
export function Avatar({ firstName, lastName, color = '#2563eb', size = 32 }: AvatarProps) {
  const initials = `${(firstName?.[0] ?? '').toUpperCase()}${(lastName?.[0] ?? '').toUpperCase()}`;
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold flex-shrink-0 select-none"
      style={{ width: size, height: size, backgroundColor: `${color}33`, color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'info' | 'warning';
interface ToastItem { id: string; message: string; type: ToastType; }

let toastDispatch: ((msg: string, type: ToastType) => void) | null = null;

export function showToast(message: string, type: ToastType = 'info') {
  toastDispatch?.(message, type);
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  useEffect(() => { toastDispatch = addToast; return () => { toastDispatch = null; }; }, [addToast]);

  const icons: Record<ToastType, string> = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
  const colors: Record<ToastType, string> = {
    success: 'border-l-green-500',
    error:   'border-l-red-500',
    info:    'border-l-blue-500',
    warning: 'border-l-amber-500',
  };

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`pc-toast bg-[#1e2d42] border border-[#2a3a52] border-l-4 ${colors[t.type]} rounded-xl px-4 py-3 text-sm min-w-[240px] flex items-center gap-2.5 pointer-events-auto shadow-xl`}>
          <span className="text-base">{icons[t.type]}</span>
          <span className="text-slate-200">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
interface StatCardProps { label: string; value: string | number; delta?: string; deltaUp?: boolean; color?: string; icon?: React.ReactNode; }
export function StatCard({ label, value, delta, deltaUp, color = '#2563eb', icon }: StatCardProps) {
  return (
    <div className="bg-[#162030] border border-[#2a3a52] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-500 font-mono">{label}</div>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>
      <div className="text-2xl font-semibold tracking-tight mb-1" style={{ color }}>{value}</div>
      {delta && (
        <div className={`text-xs ${deltaUp === true ? 'text-green-400' : deltaUp === false ? 'text-red-400' : 'text-slate-500'}`}>
          {delta}
        </div>
      )}
    </div>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
export function EmptyState({ message, icon = '📭' }: { message: string; icon?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
      <span className="text-4xl">{icon}</span>
      <span className="text-sm">{message}</span>
    </div>
  );
}

// ─── CONFIRM DIALOG ──────────────────────────────────────────────────────────
interface ConfirmProps { open: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void; loading?: boolean; }
export function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth="max-w-md">
      <p className="text-sm text-slate-300 mb-6">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>Confirm</Button>
      </div>
    </Modal>
  );
}

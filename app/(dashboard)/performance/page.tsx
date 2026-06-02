'use client';

import { useEffect, useState, useCallback } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { Card, Button, Modal, Select, Input, Spinner, EmptyState, StatCard, showToast } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { Star, Plus, TrendingUp, Award, Target } from 'lucide-react';

interface Review {
  id: string; employee_id: string; period: string;
  rating: number; kpi_achievement: number;
  strengths: string | null; improvements: string | null;
  goals: string | null; comments: string | null;
  reviewer_id: string; employee_name: string;
  reviewer_name: string; created_at: string;
}

const PERIODS = ['Q1-2025','Q2-2025','Q3-2025','Q4-2025','Annual-2024','Q4-2024','Q3-2024','Q2-2024'];
const RATING_LABELS = ['','Very Poor','Below Expectations','Meets Expectations','Good','Excellent'];
const RATING_COLORS = ['','#dc2626','#f97316','#eab308','#22c55e','#10b981'];

function StarRating({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {[1,2,3,4,5].map(i => (
            <button key={i}
                    onClick={() => onChange?.(i)}
                    onMouseEnter={() => onChange && setHover(i)}
                    onMouseLeave={() => onChange && setHover(0)}
                    style={{ background: 'none', border: 'none', cursor: onChange ? 'pointer' : 'default', padding: 0, display: 'flex' }}>
              <Star size={18} style={{ color: i <= (hover || rating) ? '#fbbf24' : '#334155', fill: i <= (hover || rating) ? '#fbbf24' : 'none' }} />
            </button>
        ))}
        {rating > 0 && (
            <span style={{ fontSize: 11, color: RATING_COLORS[rating], fontWeight: 600, marginLeft: 4 }}>
          {RATING_LABELS[rating]}
        </span>
        )}
      </div>
  );
}

export default function PerformancePage() {
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [employees, setEmps]    = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [selected, setSelected] = useState<Review | null>(null);
  const [form, setForm]         = useState({
    employee_id: '', period: 'Q2-2025',
    rating: 0, kpi_achievement: 100,
    strengths: '', improvements: '', goals: '', comments: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/performance');
      const j = await r.json();
      setReviews(j.data ?? []);
    } catch { showToast('Failed to load reviews', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/employees?limit=200')
        .then(r => r.json())
        .then(j => setEmps(j.data ?? []));
  }, []);

  const submit = async () => {
    if (!form.employee_id) { showToast('Select an employee', 'error'); return; }
    if (!form.rating)      { showToast('Select a rating', 'error'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/performance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      showToast('Review submitted', 'success');
      setModal(false);
      setForm({ employee_id: '', period: 'Q2-2025', rating: 0, kpi_achievement: 100, strengths: '', improvements: '', goals: '', comments: '' });
      load();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed', 'error');
    } finally { setSaving(false); }
  };

  const avgRating = reviews.length ? (reviews.reduce((s,r) => s + r.rating, 0) / reviews.length).toFixed(1) : '—';
  const avgKPI    = reviews.length ? Math.round(reviews.reduce((s,r) => s + r.kpi_achievement, 0) / reviews.length) : 0;
  const topPerformers = reviews.filter(r => r.rating >= 4).length;
  const needsSupport  = reviews.filter(r => r.rating <= 2).length;

  return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <Topbar title="Performance Reviews" action={
          <Button variant="primary" onClick={() => { setSelected(null); setModal(true); }}>
            <Plus size={14} /> New Review
          </Button>
        } />

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            <StatCard label="Total Reviews"  value={reviews.length} color="#2563eb" icon={<Award size={16}/>} />
            <StatCard label="Avg Rating"     value={avgRating}      color="#d97706" icon={<Star size={16}/>} delta="out of 5.0" />
            <StatCard label="Avg KPI"        value={`${avgKPI}%`}   color="#16a34a" icon={<Target size={16}/>} />
            <StatCard label="Top Performers" value={topPerformers}  color="#7c3aed" icon={<TrendingUp size={16}/>} delta={needsSupport > 0 ? `${needsSupport} need support` : 'All on track'} />
          </div>

          {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size={28} /></div>
          ) : reviews.length === 0 ? (
              <EmptyState message="No performance reviews yet" icon="⭐" />
          ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
                {reviews.map(rev => (
                    <div key={rev.id} onClick={() => setSelected(rev)}
                         style={{ backgroundColor: '#162030', border: `1px solid ${selected?.id === rev.id ? '#2563eb' : '#2a3a52'}`, borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'border-color .2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{rev.employee_name}</div>
                          <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>{rev.period}</div>
                        </div>
                        <div style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, backgroundColor: `${RATING_COLORS[rev.rating]}22`, border: `1px solid ${RATING_COLORS[rev.rating]}66`, color: RATING_COLORS[rev.rating], fontWeight: 600 }}>
                          {RATING_LABELS[rev.rating]}
                        </div>
                      </div>
                      <StarRating rating={rev.rating} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                        <div style={{ backgroundColor: '#1e2d42', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 3 }}>KPI</div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: rev.kpi_achievement >= 90 ? '#4ade80' : rev.kpi_achievement >= 70 ? '#fbbf24' : '#f87171', fontFamily: 'monospace' }}>{rev.kpi_achievement}%</div>
                        </div>
                        <div style={{ backgroundColor: '#1e2d42', borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 3 }}>Reviewer</div>
                          <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rev.reviewer_name}</div>
                        </div>
                      </div>
                      {rev.comments && (
                          <div style={{ marginTop: 10, fontSize: 12, color: '#64748b', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{rev.comments}</div>
                      )}
                      <div style={{ marginTop: 10, fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>{formatDate(rev.created_at)}</div>
                    </div>
                ))}
              </div>
          )}

          {selected && (
              <div style={{ marginTop: 16, backgroundColor: '#162030', border: '1px solid #2563eb', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>{selected.employee_name} — {selected.period}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Reviewed by {selected.reviewer_name} on {formatDate(selected.created_at)}</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 18 }}>✕</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                  {[
                    { label: '💪 Strengths',         content: selected.strengths },
                    { label: '🎯 Areas to Improve',  content: selected.improvements },
                    { label: '📋 Goals',             content: selected.goals },
                  ].map(s => s.content && (
                      <div key={s.label} style={{ backgroundColor: '#1e2d42', borderRadius: 10, padding: 14 }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginBottom: 8 }}>{s.label}</div>
                        <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{s.content}</div>
                      </div>
                  ))}
                </div>
                {selected.comments && (
                    <div style={{ marginTop: 12, backgroundColor: '#1e2d42', borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', marginBottom: 8 }}>💬 Comments</div>
                      <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.comments}</div>
                    </div>
                )}
              </div>
          )}
        </div>

        <Modal open={modal} onClose={() => setModal(false)} title="New Performance Review" maxWidth="max-w-lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select label="Employee *" value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
                <option value="">Select employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </Select>
              <Select label="Review Period *" value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))}>
                {PERIODS.map(p => <option key={p}>{p}</option>)}
              </Select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace' }}>Rating *</label>
              <div style={{ padding: '10px 14px', backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 8 }}>
                <StarRating rating={form.rating} onChange={r => setForm(p => ({ ...p, rating: r }))} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace' }}>KPI Achievement: {form.kpi_achievement}%</label>
              <input type="range" min={0} max={150} value={form.kpi_achievement}
                     onChange={e => setForm(p => ({ ...p, kpi_achievement: parseInt(e.target.value) }))}
                     style={{ accentColor: '#2563eb' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>
                <span>0%</span><span>75%</span><span>100%</span><span>150%</span>
              </div>
            </div>
            {[
              { key: 'strengths',    label: 'Strengths',            placeholder: 'Key achievements and strengths…' },
              { key: 'improvements', label: 'Areas to Improve',     placeholder: 'Areas needing development…' },
              { key: 'goals',        label: 'Goals for Next Period', placeholder: 'Target outcomes and goals…' },
              { key: 'comments',     label: 'General Comments',     placeholder: 'Overall review comments…' },
            ].map(f => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontFamily: 'monospace' }}>{f.label}</label>
                  <textarea value={(form as Record<string,unknown>)[f.key] as string}
                            onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                            placeholder={f.placeholder} rows={2}
                            style={{ backgroundColor: '#1e2d42', border: '1px solid #2a3a52', borderRadius: 8, color: '#f1f5f9', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }} />
                </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, paddingTop: 14, borderTop: '1px solid #2a3a52' }}>
            <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={submit} loading={saving}>Submit Review</Button>
          </div>
        </Modal>
      </div>
  );
}
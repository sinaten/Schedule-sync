'use client';
import { useEffect, useState } from 'react';

// The person's own work: the action plans assigned to them for today and tomorrow (start and end day both included).
// The data is loaded by the shell (it also fills the thin strip under the tabs); this draws the list.
export const localDay = (add) => { const d = new Date(); d.setDate(d.getDate() + (add || 0)); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export function useMyWork(job) {
  const [d, setD] = useState(null);
  useEffect(() => {
    if (!job) return;
    let on = true;
    const load = () => fetch('/api/mywork?job=' + encodeURIComponent(job) + '&d=' + localDay(0), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (on && j && j.today) setD(j); }).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => { on = false; clearInterval(t); };
  }, [job]);
  return d;
}
const lab = { fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8a877b', margin: '10px 2px 6px' };
const fmt = (s) => { const [y, m, d] = String(s).split('-'); return m && d ? m + '/' + d : s; };
function Card({ a }) {
  return (
    <div style={{ border: '1px solid #efece3', borderRadius: 12, background: '#fff', padding: '9px 12px', marginBottom: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12, color: '#8a877b' }}><b style={{ color: '#D97757', fontWeight: 600 }}>{a.card}</b><span>{a.jobNo}</span><span>Element {a.element_id}</span><span style={{ marginLeft: 'auto' }}>{fmt(a.start)}{a.end !== a.start ? ' – ' + fmt(a.end) : ''}</span></div>
      {a.title && <div style={{ fontSize: 14, marginTop: 3 }}>{a.title}</div>}
      {a.how && <div style={{ fontSize: 12.5, color: '#6b675c', marginTop: 3 }}>{a.how}</div>}
    </div>
  );
}
export default function MyWork({ data }) {
  if (!data) return <div style={{ padding: '14px 16px', fontSize: 13, color: '#8a877b' }}>Loading your work…</div>;
  const none = !data.today.length && !data.tomorrow.length;
  return (
    <div style={{ padding: '2px 16px 12px', maxWidth: 520, margin: '0 auto' }}>
      {none && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #efece3', borderRadius: 12, background: '#fff', padding: '14px 16px', marginTop: 8 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8a877b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9h12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M16 10h2a2 2 0 0 1 0 4h-2" /><path d="M7 4v2M10 4v2M13 4v2" /></svg>
          <div><div style={{ fontSize: 14, fontWeight: 500 }}>Nothing today</div><div style={{ fontSize: 12.5, color: '#6b675c', marginTop: 2 }}>{data.next ? 'Next: ' + fmt(data.next.start) + ' · ' + (data.next.title || data.next.card) : 'No work is planned for you yet.'}</div></div>
        </div>
      )}
      {data.today.length > 0 && <><div style={lab}>Today · {data.today.length}</div>{data.today.map((a) => <Card key={'t' + a.element_id} a={a} />)}</>}
      {data.tomorrow.length > 0 && <><div style={lab}>Tomorrow · {data.tomorrow.length}</div>{data.tomorrow.map((a) => <Card key={'n' + a.element_id} a={a} />)}</>}
    </div>
  );
}

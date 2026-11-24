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
    const load = () => fetch('/api/mywork?job=' + encodeURIComponent(job) + '&d=' + localDay(0), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : { today: [], tomorrow: [], next: null, err: 'Error ' + r.status })).then((j) => { if (on && j && j.today) setD(j); }).catch(() => { if (on) setD((x) => x || { today: [], tomorrow: [], next: null, err: 'No connection' }); });
    load();
    const t = setInterval(load, 60000);
    return () => { on = false; clearInterval(t); };
  }, [job]);
  return d;
}
const lab = { fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: '#8a877b', margin: '10px 2px 6px' };
const fmt = (s) => { const [y, m, d] = String(s).split('-'); return m && d ? m + '/' + d : s; };
function Card({ a, open, onToggle }) {
  return (
    <div style={{ border: '1px solid ' + (open ? '#D97757' : '#efece3'), borderRadius: 12, background: '#fff', marginBottom: 6, overflow: 'hidden' }}>
      <button type="button" onClick={onToggle} aria-expanded={open} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '10px 12px', border: 0, background: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        <b style={{ color: '#D97757', fontWeight: 600, fontSize: 12 }}>{a.card}{a.project ? <span style={{ color: '#8a877b', fontWeight: 500 }}> \u2013 {String(a.project).length > 16 ? String(a.project).slice(0, 15) + '\u2026' : a.project}</span> : null}</b>
        <span style={{ flex: 1, fontSize: 14, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap' }}>{a.title || 'Element ' + a.element_id}</span>
        <span style={{ fontSize: 12, color: '#8a877b' }}>{fmt(a.start)}{a.end !== a.start ? ' \u2013 ' + fmt(a.end) : ''}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a877b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div style={{ padding: '0 12px 11px', fontSize: 12.5, color: '#6b675c' }}>
          <div style={{ display: 'flex', gap: 10, color: '#8a877b' }}><span>{a.jobNo}</span><span>Element {a.element_id}</span></div>
          {a.how && <div style={{ marginTop: 5 }}>{a.how}</div>}
        </div>
      )}
    </div>
  );
}
export default function MyWork({ data }) {
  const [openKey, setOpenKey] = useState('');
  const toggle = (k, a) => {
    if (openKey === k) { setOpenKey(''); return; }
    setOpenKey(k);
    // the 3D model comes up and shows the element (switching to the Revit 3D view that contains it)
    setTimeout(() => { try { const b = document.querySelector('.v3-box'); if (b) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* ignore */ } }, 50);
    try { if (window.__ssOpenElement) window.__ssOpenElement(a.element_id).then((r) => { if (r && !r.ok) window.dispatchEvent(new CustomEvent('ss-elem-msg', { detail: r.msg })); }); } catch (e) { /* ignore */ }
  };
  if (!data) return <div style={{ padding: '14px 16px', fontSize: 13, color: '#8a877b' }}>Loading your work…</div>;
  if (data.err) return <div style={{ padding: '14px 16px', fontSize: 13, color: '#b3261e' }}>Could not load your work ({data.err}).</div>;
  const none = !data.today.length && !data.tomorrow.length;
  return (
    <div style={{ padding: '2px 16px 12px', maxWidth: 520, margin: '0 auto' }}>
      {none && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #efece3', borderRadius: 12, background: '#fff', padding: '14px 16px', marginTop: 8 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8a877b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9h12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M16 10h2a2 2 0 0 1 0 4h-2" /><path d="M7 4v2M10 4v2M13 4v2" /></svg>
          <div><div style={{ fontSize: 14, fontWeight: 500 }}>Nothing today</div><div style={{ fontSize: 12.5, color: '#6b675c', marginTop: 2 }}>{data.next ? 'Next: ' + fmt(data.next.start) + ' · ' + (data.next.title || data.next.card) : 'No work is planned for you yet.'}</div></div>
        </div>
      )}
      {data.today.length > 0 && <><div style={lab}>Today · {data.today.length}</div>{data.today.map((a) => <Card key={'t' + a.element_id} a={a} open={openKey === 't' + a.element_id} onToggle={() => toggle('t' + a.element_id, a)} />)}</>}
      {data.tomorrow.length > 0 && <><div style={lab}>Tomorrow · {data.tomorrow.length}</div>{data.tomorrow.map((a) => <Card key={'n' + a.element_id} a={a} open={openKey === 'n' + a.element_id} onToggle={() => toggle('n' + a.element_id, a)} />)}</>}
    </div>
  );
}

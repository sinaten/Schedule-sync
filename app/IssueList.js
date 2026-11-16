'use client';
import { useEffect, useState } from 'react';
import { TOKEN } from '../lib/camviews';
import CamIcon from './CamIcon';
import { goPart, linkNums, useModelIds } from './ElemLinks';

// Status model of an issue (same words as Procore).
export const ST = {
  open: { l: 'Open', bg: '#fdecea', c: '#c0392b' },
  prog: { l: 'In Progress', bg: '#fff3dc', c: '#a86400' },
  done: { l: 'Work Complete', bg: '#e6f0fc', c: '#1a5fb4' },
  closed: { l: 'Closed', bg: '#e4f5ea', c: '#1e7a45' },
};
const KEYS = ['open', 'prog', 'done', 'closed'];
const when = (t) => { const d = new Date(t); return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };

// Status chip with a menu to change it.
export function StatusChip({ st, onPick }) {
  const [o, setO] = useState(false);
  const s = ST[st] || ST.open;
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={(e) => { e.stopPropagation(); setO((x) => !x); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 0, background: s.bg, color: s.c, borderRadius: 7, padding: '2px 8px', font: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: 0.2, cursor: 'pointer', whiteSpace: 'nowrap' }}>{s.l.toUpperCase()} <span style={{ fontSize: 9 }}>{'▾'}</span></button>
      {o && (
        <>
          <div onClick={() => setO(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div style={{ position: 'absolute', top: '115%', left: 0, zIndex: 41, minWidth: 170, background: '#fff', border: '1px solid #efece3', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,.2)', padding: 4 }}>
            {KEYS.map((k) => (
              <button key={k} type="button" onClick={(e) => { e.stopPropagation(); setO(false); if (k !== st) onPick(k); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: 0, background: 'none', padding: '8px 10px', font: 'inherit', fontSize: 13.5, borderRadius: 8, cursor: 'pointer', color: '#141413' }}>
                <span style={{ width: 14, color: '#2e9e5b' }}>{k === st ? '✓' : ''}</span>{ST[k].l}
              </button>
            ))}
          </div>
        </>
      )}
    </span>
  );
}

// All issues of the job: card number, status, text with clickable element numbers, who and when, counts.
export default function IssueList({ job }) {
  const [rows, setRows] = useState(null);
  const [cvs, setCvs] = useState([]);
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const [newest, setNewest] = useState(true);
  const [open, setOpen] = useState(true);
  useModelIds();
  const load = () => fetch('/api/issue?list=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.issues) setRows(j.issues); }).catch(() => {});
  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    window.addEventListener('focus', load);
    return () => { clearInterval(t); window.removeEventListener('focus', load); };
  }, [job]);
  useEffect(() => {
    fetch('/api/camviews?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.views) setCvs(j.views); }).catch(() => {});
  }, [job]);

  const setStatus = async (r, status) => {
    setRows((rs) => rs.map((x) => (x.element_id === r.element_id ? { ...x, status } : x)));
    const res = await fetch('/api/issue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, element: r.element_id, action: 'status', status }) });
    if (!res.ok) load();
  };
  // text with [[view:ID]] drawn as its icon and every element number of the model as a blue link
  const rich = (t, key) => {
    const out = []; let last = 0, m, k = 0;
    const re = new RegExp(TOKEN.source, 'gi');
    while ((m = re.exec(t))) {
      if (m.index > last) out.push(<span key={k++}>{linkNums(t.slice(last, m.index), key + 'a' + k)}</span>);
      const v = cvs.find((x) => x.id === m[1]);
      out.push(v ? <button key={k++} type="button" title={v.name} onClick={() => window.dispatchEvent(new CustomEvent('ss-goto-view', { detail: { id: v.id } }))} style={{ display: 'inline', border: 0, background: 'none', padding: 0, font: 'inherit', cursor: 'pointer' }}><CamIcon n={v.n} /></button> : <span key={k++} style={{ opacity: 0.4 }}>{'\u{1F6AB}'}</span>);
      last = m.index + m[0].length;
    }
    if (last < t.length) out.push(<span key={k++}>{linkNums(t.slice(last), key + 'z' + k)}</span>);
    return out;
  };

  if (!rows) return null;
  const s = q.trim().toLowerCase();
  let list = rows.filter((r) => (f === 'all' || r.status === f) && (!s || (r.card + ' ' + r.element_id + ' ' + r.description + ' ' + (r.author || '')).toLowerCase().includes(s)));
  if (!newest) list = list.slice().reverse();
  const chip = (k, label) => <button key={k} type="button" onClick={() => setF(k)} style={{ border: 0, borderRadius: 14, padding: '5px 12px', font: 'inherit', fontSize: 12.5, cursor: 'pointer', background: f === k ? 'rgba(20,20,19,.82)' : '#f4f3ee', color: f === k ? '#fff' : '#141413', fontWeight: f === k ? 600 : 500 }}>{label}</button>;
  return (
    <section style={{ margin: '18px 0', maxWidth: 560 }}>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ display: 'flex', width: '100%', alignItems: 'baseline', justifyContent: 'space-between', border: 0, background: 'none', padding: '0 2px', font: 'inherit', cursor: 'pointer', color: '#141413' }}>
        <span style={{ fontSize: 17, fontWeight: 600 }}>Issues</span>
        <span style={{ fontSize: 12.5, color: '#8a8576' }}>{list.length} of {rows.length} {open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search card no., text or element number" style={{ width: '100%', boxSizing: 'border-box', height: 34, margin: '8px 0', border: '1.5px solid #e0dccf', borderRadius: 17, padding: '0 14px', font: 'inherit', fontSize: 13.5, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
            {chip('all', 'All')}{KEYS.map((k) => chip(k, ST[k].l))}
            <span style={{ flex: 1 }} />
            <button type="button" onClick={() => setNewest((n) => !n)} style={{ border: 0, borderRadius: 14, padding: '5px 10px', background: '#f4f3ee', font: 'inherit', fontSize: 12, cursor: 'pointer' }}>{newest ? 'Newest' : 'Oldest'} {'↕'}</button>
          </div>
          {list.length === 0 && <p style={{ textAlign: 'center', color: '#8a8576', fontSize: 13, padding: 14 }}>{rows.length ? 'No issue found.' : 'No issues in this project yet.'}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((r) => (
              <div key={r.element_id} style={{ border: '1px solid #e7e3d8', borderRadius: 12, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f7f5ef', borderRadius: '12px 12px 0 0' }}>
                  <b style={{ fontSize: 13.5 }}>{r.card}</b>
                  <StatusChip st={r.status} onPick={(k) => setStatus(r, k)} />
                  <span style={{ flex: 1 }} />
                  <button type="button" onClick={() => goPart(r.element_id)} style={{ border: 0, background: 'none', font: 'inherit', fontSize: 12.5, color: '#6b675c', cursor: 'pointer' }}>{'▣'} Go to 3D</button>
                </div>
                <div style={{ padding: '8px 12px', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#141413' }}>
                  {r.description ? rich(r.description, 'i' + r.no) : <span style={{ color: '#9a9686' }}>No description.</span>}
                  <div style={{ marginTop: 4, fontSize: 12.5, color: '#6b675c' }}>Element {linkNums(r.element_id, 'e' + r.no) === String(r.element_id) ? r.element_id : linkNums(r.element_id, 'e' + r.no)}</div>
                </div>
                <div style={{ padding: '0 12px 8px', fontSize: 12, color: '#8a8576' }}>{r.author || ''} {'·'} {when(r.created_at)}</div>
                <div style={{ display: 'flex', gap: 14, padding: '7px 12px', borderTop: '1px solid #efece3', fontSize: 12.5 }}>
                  <span>Comments <b>{r.comments}</b></span><span>Files <b>{r.files}</b></span><span>Gallery <b>{r.photos}</b></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

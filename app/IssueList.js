'use client';
import { useEffect, useState } from 'react';
import { TOKEN } from '../lib/camviews';
import CamIcon from './CamIcon';
import { goPart, linkNums, useModelIds } from './ElemLinks';

// Status model of an issue (same words as Procore).
export const ST = {
  open: { l: 'Open', bg: '#fdecea', c: '#c0392b' },
  prog: { l: 'In Progress', bg: '#fff3dc', c: '#a86400' },
  ready: { l: 'Ready to Inspect', bg: '#e1effb', c: '#1a6fd4' },
  done: { l: 'Work Complete', bg: '#e6f0fc', c: '#1a5fb4' },
  closed: { l: 'Closed', bg: '#e4f5ea', c: '#1e7a45' },
};
const KEYS = ['open', 'prog', 'ready', 'done', 'closed'];
// Importance tag
export const PR = { critical: { l: 'Critical', bg: '#c0392b', c: '#fff' }, noncritical: { l: 'Non-Critical', bg: '#e0b422', c: '#fff' } };
export function PriorityTag({ pr }) {
  const p = PR[pr] || PR.noncritical;
  return <span style={{ background: p.bg, color: p.c, borderRadius: 5, padding: '2px 7px', fontSize: 10.5, fontWeight: 700, letterSpacing: 0.3, whiteSpace: 'nowrap' }}>{p.l.toUpperCase()}</span>;
}
const when = (t) => { const d = new Date(t); return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };

// Status chip with a menu to change it.
export function StatusChip({ st, onPick, locked }) {
  const [o, setO] = useState(false);
  const s = ST[st] || ST.open;
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={(e) => { e.stopPropagation(); if (!locked) setO((x) => !x); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 0, background: s.bg, color: s.c, borderRadius: 7, padding: '2px 8px', font: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: 0.2, cursor: locked ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>{s.l.toUpperCase()}{!locked && <span style={{ fontSize: 9 }}> {'▾'}</span>}</button>
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
  const [who, setWho] = useState({ me: '', can: false });
  const [cvs, setCvs] = useState([]);
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const [newest, setNewest] = useState(true);
  const [open, setOpen] = useState(true);
  const [ed, setEd] = useState(null); // the card being edited: { element_id, text, pr }
  useModelIds();
  const load = () => fetch('/api/issue?list=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.issues) { setRows(j.issues); setWho({ me: j.me, can: !!j.can }); } }).catch(() => {});
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
  const saveEdit = async () => {
    const r = rows.find((x) => x.element_id === ed.element_id);
    const post = (b) => fetch('/api/issue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, element: ed.element_id, ...b }) });
    if (r && ed.text !== r.description) await post({ description: ed.text });
    if (r && ed.pr !== r.priority) await post({ action: 'priority', priority: ed.pr });
    setEd(null); load();
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
            {list.map((r) => {
              const can = who.can || !r.author || r.author === who.me;
              const mine = ed && ed.element_id === r.element_id;
              const info = (k, v) => v ? <div style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.6 }}><span style={{ width: 84, flex: 'none', color: '#8a8576', fontWeight: 700, fontSize: 11, letterSpacing: 0.3, textTransform: 'uppercase', paddingTop: 1 }}>{k}</span><span style={{ color: '#141413', wordBreak: 'break-word' }}>{v}</span></div> : null;
              return (
                <div key={r.element_id} style={{ border: '1px solid #e7e3d8', borderRadius: 12, background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f7f5ef', borderRadius: '12px 12px 0 0', flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 13.5 }}>{r.card}</b>
                    <StatusChip st={r.status} onPick={(k) => setStatus(r, k)} locked={!can} />
                    <PriorityTag pr={r.priority} />
                    <span style={{ flex: 1 }} />
                    <button type="button" disabled={!can} title={can ? 'Edit this issue' : 'Only the author, an editor or a manager can edit'} onClick={() => setEd(mine ? null : { element_id: r.element_id, text: r.description || '', pr: r.priority || 'noncritical' })} style={{ border: '1px solid ' + (can ? '#e8710a' : '#d9d5c8'), background: '#fff', color: can ? '#e8710a' : '#b0ab9a', borderRadius: 12, padding: '3px 12px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: can ? 'pointer' : 'not-allowed' }}>Edit</button>
                    <button type="button" onClick={() => goPart(r.element_id)} style={{ border: 0, background: 'none', font: 'inherit', fontSize: 12.5, color: '#6b675c', cursor: 'pointer' }}>{'▣'} Go to 3D</button>
                  </div>
                  {mine ? (
                    <div style={{ padding: 10 }}>
                      <textarea value={ed.text} onChange={(e) => setEd({ ...ed, text: e.target.value })} rows={4} placeholder="Describe the issue…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', border: '1.5px solid #e0dccf', borderRadius: 10, padding: 8, font: 'inherit', fontSize: 14, resize: 'vertical', outline: 'none' }} />
                      <div style={{ display: 'flex', gap: 6, margin: '8px 0', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#8a8576', marginRight: 4 }}>Importance</span>
                        {['critical', 'noncritical'].map((k) => <button key={k} type="button" onClick={() => setEd({ ...ed, pr: k })} style={{ border: '1.5px solid ' + (ed.pr === k ? PR[k].bg : '#e0dccf'), background: ed.pr === k ? PR[k].bg : '#fff', color: ed.pr === k ? '#fff' : '#141413', borderRadius: 12, padding: '3px 11px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{PR[k].l}</button>)}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={saveEdit} style={{ border: 0, background: '#e8710a', color: '#fff', borderRadius: 14, padding: '6px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                        <button type="button" onClick={() => setEd(null)} style={{ border: '1px solid #d9d5c8', background: '#fff', borderRadius: 14, padding: '6px 16px', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '8px 12px', fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#141413' }}>
                      {r.description ? rich(r.description, 'i' + r.no) : <span style={{ color: '#9a9686' }}>No description.</span>}
                    </div>
                  )}
                  <div style={{ padding: '4px 12px 8px', borderTop: '1px solid #f1ede4' }}>
                    {info('Element', linkNums(r.element_id, 'e' + r.no))}
                    {info('Discipline', r.discipline)}
                    {info('Asset', r.asset)}
                    {info('Created by', r.author)}
                    {info('Identified on', when(r.created_at))}
                  </div>
                  <div style={{ display: 'flex', gap: 14, padding: '7px 12px', borderTop: '1px solid #efece3', fontSize: 12.5 }}>
                    <span>Comments <b>{r.comments}</b></span><span>Files <b>{r.files}</b></span><span>Gallery <b>{r.photos}</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

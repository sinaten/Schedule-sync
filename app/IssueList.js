'use client';
import { useEffect, useState } from 'react';
import { TOKEN, camToEdit, camFromEdit } from '../lib/camviews';
import CamIcon from './CamIcon';
import { goPart, linkNums, useModelIds } from './ElemLinks';
import IssuePanel from './IssuePanel';
import WeatherStrip from './WeatherStrip';
import ModelSlot from './ModelSlot';
import SecondViewer from './SecondViewer';
import { SWAP, fsBody, fsTop, fsHalf } from './layoutSwap';

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
export function PriorityTag({ pr, small }) {
  const p = PR[pr] || PR.noncritical;
  return <span style={{ background: p.bg, color: p.c, borderRadius: 5, padding: small ? '2px 5px' : '2px 7px', fontSize: small ? 9.5 : 10.5, fontWeight: 700, letterSpacing: small ? 0.1 : 0.3, whiteSpace: 'nowrap' }}>{p.l.toUpperCase()}</span>;
}
const when = (t) => { const d = new Date(t); return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };

// The window-style square at the corner of a card: one tap makes the card fill the screen, another gives it back.
export function FullBtn({ on, toggle }) {
  return (
    <button type="button" aria-label={on ? 'Restore size' : 'Full screen'} title={on ? 'Restore size' : 'Full screen'} onClick={(e) => { e.stopPropagation(); toggle(); }} style={{ flex: 'none', width: 26, height: 26, border: 0, background: 'none', padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#6b675c" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">{on ? <><rect x="2.5" y="5.5" width="8" height="8" rx="1" /><path d="M5.5 5.5V3.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" /></> : <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />}</svg>
    </button>
  );
}
// Full screen: on a wide screen (desktop, tablet lying down) the issue is the left half and the action plan the right half; on a phone the action plan is the top half and the issue the bottom half.
export function useWide() {
  const [w, setW] = useState(false);
  useEffect(() => { const f = () => setW(window.innerWidth >= 700); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  return w;
}
export const bodyBox = (on, wide) => (on ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: wide ? 'row' : 'column' } : { display: 'contents' });
export const halfStyle = (on, wide, kind, hideSmall) => (on
  ? { flex: '1 1 0', minHeight: 0, minWidth: 0, overflowY: 'auto', background: kind === 'ap' ? '#eef8f0' : '#fff7ef', order: (kind === 'ap') === !wide ? 1 : 2, ...(wide ? { borderLeft: kind === 'ap' ? '1px solid #cfe9d6' : 0 } : { borderTop: kind === 'ap' ? 0 : '2px solid #e7e3d8' }) }
  : hideSmall && kind === 'issue' ? { display: 'none' } : {});
export const fullBox = (on) => (on ? { position: 'fixed', inset: 0, zIndex: 2400, display: 'flex', flexDirection: 'column', overflowY: 'hidden', borderRadius: 0, border: 0, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', boxSizing: 'border-box', background: '#fff' } : {});

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


// Action plan of an issue: one row under the issue, opens like a drawer. Only a manager or an editor issues or changes it.
export function AssigneeChip({ a }) {
  if (a.u) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 14, background: '#f4f3ee', padding: '2px 10px 2px 3px', fontSize: 12.5 }}><span style={{ width: 22, height: 22, borderRadius: 11, background: '#e8710a', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>{a.n[0].toUpperCase()}</span>{a.n}</span>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 14, border: '1px dashed #cfcab9', padding: '2px 10px 2px 3px', fontSize: 12.5 }}><span style={{ width: 22, height: 22, borderRadius: 11, background: '#f4f3ee', color: '#6b675c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>?</span>{a.n}<span style={{ fontSize: 10, color: '#6b675c', border: '1px solid #e7e3d8', borderRadius: 6, padding: '0 5px' }}>NOT A USER</span></span>;
}
function ActionPlan({ job, r, can, post, reload, openPan, forceOpen }) {
  const ap = r.ap;
  const [o, setO] = useState(false);
  const [body, setBody] = useState(ap ? ap.body : '');
  const [pick, setPick] = useState(false);
  const [users, setUsers] = useState(null);
  const [guest, setGuest] = useState('');
  useEffect(() => { if (forceOpen) setO(true); }, [forceOpen]);
  const [jno, setJno] = useState('');
  const [sd, setSd] = useState('');
  const [ed, setEd] = useState('');
  useEffect(() => { setBody(ap ? ap.body : ''); }, [ap && ap.body]);
  useEffect(() => { setJno(ap ? ap.jobNo : ''); }, [ap && ap.jobNo]);
  useEffect(() => { setSd(ap && ap.start_date || ''); setEd(ap && ap.end_date || ''); }, [ap && ap.start_date, ap && ap.end_date]);
  if (!ap) {
    if (!can) return null;
    return (
      <div style={{ padding: '8px 12px', borderTop: '1px solid #efece3' }}>
        <button type="button" onClick={async () => { await post({ action: 'ap-create' }); await reload(); setO(true); }} style={{ border: '1px solid #e8710a', background: '#fff', color: '#e8710a', borderRadius: 14, padding: '5px 14px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Convert to Action Plan</button>
      </div>
    );
  }
  const as = Array.isArray(ap.assignees) ? ap.assignees : [];
  const save = async (b) => { await post({ action: 'ap-update', ...b }); await reload(); };
  const openPick = async () => {
    setPick((x) => !x);
    if (!users) { try { const j = await fetch('/api/issue?users=1&job=' + encodeURIComponent(job), { cache: 'no-store' }).then((x) => x.json()); setUsers(j.users || []); } catch (e) { setUsers([]); } }
  };
  const toggleUser = (n) => save({ assignees: as.some((a) => a.u && a.n === n) ? as.filter((a) => !(a.u && a.n === n)) : [...as, { n, u: 1 }] });
  const lab = { fontSize: 11, fontWeight: 700, letterSpacing: 0.3, color: '#8a8576', textTransform: 'uppercase' };
  return (
    <div style={{ borderTop: '1.5px solid #8fcfa2', background: '#eef8f0', borderRadius: '0 0 11px 11px' }}>
      <div role="button" tabIndex={0} onClick={() => setO((x) => !x)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: '#2c7a47' }}>ACTION PLAN</span>
        <b style={{ fontSize: 13 }}>{ap.jobNo}</b>
        <span onClick={(e) => e.stopPropagation()}><StatusChip st={ap.status} onPick={(k) => save({ status: k })} locked={!can} /></span>
        <span style={{ flex: 1 }} />
        <span style={{ display: 'flex' }}>{as.map((a, i) => <span key={i} title={a.n} style={{ width: 22, height: 22, borderRadius: 11, marginLeft: -6, border: '1.5px solid #eef8f0', boxSizing: 'border-box', background: a.u ? '#e8710a' : '#f4f3ee', color: a.u ? '#fff' : '#6b675c', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>{a.u ? a.n[0].toUpperCase() : '?'}</span>)}</span>
        <span style={{ color: '#9a9686', fontSize: 12 }}>{o ? '▴' : '▾'}</span>
      </div>
      {o && (
        <div style={{ padding: '4px 12px 12px' }}>
          <WeatherStrip job={job} />
          <div style={{ display: 'flex', gap: 6, margin: '0 0 10px' }}>
            <label style={{ flex: '0.8 1 0', minWidth: 0 }}><span style={lab}>Job number</span>
              {can ? <input value={jno} onChange={(e) => setJno(e.target.value)} onBlur={() => { if (jno.trim() && jno !== ap.jobNo) save({ job_no: jno }); }} placeholder="Job number" style={{ display: 'block', width: '100%', boxSizing: 'border-box', border: '1.5px solid #cfe9d6', borderRadius: 10, height: 34, padding: '0 6px', margin: '4px 0 0', font: 'inherit', fontSize: 12.5, textOverflow: 'ellipsis', outline: 'none', background: '#fff' }} /> : <div style={{ fontSize: 13, margin: '4px 0 0' }}>{ap.jobNo}</div>}
            </label>
            {[['Start date', sd, setSd, 'start_date'], ['End date', ed, setEd, 'end_date']].map(([l, v, set, k]) => (
              <label key={k} style={{ flex: '1.1 1 0', minWidth: 0 }}><span style={lab}>{l}</span>
                {can ? <input type="date" value={v} min={k === 'end_date' ? sd || undefined : undefined} onChange={(e) => { set(e.target.value); save({ [k]: e.target.value }); }} style={{ display: 'block', width: '100%', boxSizing: 'border-box', border: '1.5px solid #cfe9d6', borderRadius: 10, height: 34, padding: '0 8px', margin: '4px 0 0', font: 'inherit', fontSize: 13.5, outline: 'none', background: '#fff' }} /> : <div style={{ fontSize: 14, marginTop: 4 }}>{v || '-'}</div>}
              </label>
            ))}
          </div>
          <div style={lab}>How to solve it</div>
          {can ? (
            <textarea value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => { if (body !== ap.body) save({ body }); }} rows={3} placeholder="How should this be solved?" style={{ display: 'block', width: '100%', boxSizing: 'border-box', border: '1.5px solid #cfe9d6', borderRadius: 10, padding: 8, margin: '4px 0 10px', font: 'inherit', fontSize: 14, resize: 'vertical', outline: 'none', background: '#fff' }} />
          ) : <div style={{ fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap', margin: '4px 0 10px' }}>{ap.body ? linkNums(ap.body, 'ap' + r.no) : <span style={{ color: '#9a9686' }}>Not written yet.</span>}</div>}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={lab}>Assigned to</span>
            {can && <button type="button" onClick={openPick} style={{ border: '1px solid #d9d5c8', background: '#fff', borderRadius: 12, padding: '2px 12px', font: 'inherit', fontSize: 12, cursor: 'pointer' }}>Assign</button>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>{as.length ? as.map((a, i) => <AssigneeChip key={i} a={a} />) : <span style={{ fontSize: 12.5, color: '#9a9686' }}>Nobody yet</span>}</div>
          {can && pick && (
            <div style={{ marginTop: 8, border: '1px solid #e0dccf', borderRadius: 10, padding: 8, background: '#fff' }}>
              <div style={lab}>Site users</div>
              {users === null && <div style={{ fontSize: 13, color: '#9a9686', padding: 4 }}>Loading…</div>}
              {(users || []).map((x) => <label key={x.n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 2px', fontSize: 13.5 }}><input type="checkbox" checked={as.some((a) => a.u && a.n === x.n)} onChange={() => toggleUser(x.n)} /><span style={{ flex: 1 }}>{x.n}</span><span style={{ fontSize: 10.5, color: '#8a8576' }}>{x.role}</span>{!x.access && <span title="This person cannot open this job yet, so they will not see the action plan" style={{ fontSize: 10, color: '#a86400', background: '#fff3dc', borderRadius: 6, padding: '0 5px' }}>NO ACCESS TO THIS JOB</span>}</label>)}
              <div style={{ ...lab, margin: '8px 0 4px' }}>Someone who is not a user</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={guest} onChange={(e) => setGuest(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && guest.trim()) { save({ assignees: [...as, { n: guest.trim(), u: 0 }] }); setGuest(''); } }} placeholder="Name, company" style={{ flex: 1, minWidth: 0, height: 32, border: '1.5px solid #e0dccf', borderRadius: 16, padding: '0 12px', font: 'inherit', fontSize: 13, outline: 'none' }} />
                <button type="button" disabled={!guest.trim()} onClick={() => { save({ assignees: [...as, { n: guest.trim(), u: 0 }] }); setGuest(''); }} style={{ border: 0, borderRadius: 16, padding: '0 14px', background: guest.trim() ? '#e8710a' : '#e7e3d8', color: '#fff', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: guest.trim() ? 'pointer' : 'default' }}>Add</button>
              </div>
              {as.filter((a) => !a.u).map((a, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 13 }}><span style={{ flex: 1 }}>{a.n} <span style={{ fontSize: 10, color: '#6b675c' }}>(not a user)</span></span><button type="button" onClick={() => save({ assignees: as.filter((x) => x !== a) })} style={{ border: 0, background: 'none', color: '#9a9686', cursor: 'pointer' }}>{'✕'}</button></div>)}
            </div>
          )}
          {can && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <button type="button" onClick={async () => { setPick(false); await save({ body, job_no: jno }); setO(false); }} style={{ border: 0, background: '#2e9e5b', color: '#fff', borderRadius: 14, padding: '7px 22px', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Save</button>
            </div>
          )}
        </div>
      )}
    </div>
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
  // Source view = real data only: the list folds into a grey bar until the Issue bar is chosen
  const [src, setSrc] = useState(() => { try { return typeof window !== 'undefined' && (window.__ssMode || localStorage.getItem('ss-mode:' + job)) === 'source'; } catch (e) { return false; } });
  useEffect(() => { const f = (e) => setSrc(e.detail === 'source'); window.addEventListener('ss-mode', f); return () => window.removeEventListener('ss-mode', f); }, []);
  const [full, setFull] = useState(null); // the card shown over the whole screen
  const wide = useWide();
  const [pan, setPan] = useState(null); // Comments / Files / Gallery of one card: { element, sheet }
  const [nw, setNw] = useState(null); // new issue without an element: { text, pr }
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
  const createNew = async () => {
    if (!nw || !nw.text.trim()) return;
    const res = await fetch('/api/issue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, action: 'create', description: nw.text, priority: nw.pr }) });
    if (res.ok) { setNw(null); setQ(''); setF('all'); setNewest(true); load(); }
  };
  const apPost = (r) => (b) => fetch('/api/issue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, element: r.element_id, ...b }) });
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
      {job && <SecondViewer job={job} />}
      {src && (
        <div aria-disabled="true" title="Choose the Issue bar under the model to use the issues" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '1px solid #e7e3d8', borderRadius: 14, background: '#f1f0ec', color: '#a8a496', cursor: 'default' }}>
          <span style={{ fontSize: 15.5, fontWeight: 600 }}>Issues</span>
          <span style={{ fontSize: 12 }}>Choose the Issue bar</span>
        </div>
      )}
      {!src && <>
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ display: 'flex', width: '100%', alignItems: 'baseline', justifyContent: 'space-between', border: 0, background: 'none', padding: '0 2px', font: 'inherit', cursor: 'pointer', color: '#141413' }}>
        <span style={{ fontSize: 17, fontWeight: 600 }}>Issues</span>
        <span style={{ fontSize: 12.5, color: '#8a8576' }}>{list.length} of {rows.length} {open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search card no., text or element number" style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', height: 34, border: '1.5px solid #e0dccf', borderRadius: 17, padding: '0 14px', font: 'inherit', fontSize: 13.5, outline: 'none' }} />
            <button type="button" aria-label="New issue" title="New issue (no element needed)" onClick={() => setNw(nw ? null : { text: '', pr: 'noncritical' })} style={{ flex: 'none', width: 34, height: 34, borderRadius: 17, border: '1.5px solid #e8710a', background: nw ? '#fff7ef' : '#fff', color: '#e8710a', fontSize: 22, lineHeight: '28px', padding: 0, cursor: 'pointer' }}>+</button>
          </div>
          {nw && (
            <div style={{ border: '1.5px solid #e8710a', borderRadius: 12, background: '#fffaf4', padding: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8a4a0a', marginBottom: 6 }}>New issue</div>
              <textarea autoFocus value={nw.text} onChange={(e) => setNw({ ...nw, text: e.target.value })} rows={4} placeholder="Describe the issue… (you can type element numbers in the text)" style={{ display: 'block', width: '100%', boxSizing: 'border-box', border: '1.5px solid #e0dccf', borderRadius: 10, padding: 8, font: 'inherit', fontSize: 14, resize: 'vertical', outline: 'none', background: '#fff' }} />
              <div style={{ display: 'flex', gap: 6, margin: '8px 0', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#8a8576', marginRight: 4 }}>Importance</span>
                {['critical', 'noncritical'].map((k) => <button key={k} type="button" onClick={() => setNw({ ...nw, pr: k })} style={{ border: '1.5px solid ' + (nw.pr === k ? PR[k].bg : '#e0dccf'), background: nw.pr === k ? PR[k].bg : '#fff', color: nw.pr === k ? '#fff' : '#141413', borderRadius: 12, padding: '3px 11px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{PR[k].l}</button>)}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={createNew} disabled={!nw.text.trim()} style={{ border: 0, background: nw.text.trim() ? '#e8710a' : '#e7e3d8', color: '#fff', borderRadius: 14, padding: '6px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: nw.text.trim() ? 'pointer' : 'default' }}>Create</button>
                <button type="button" onClick={() => setNw(null)} style={{ border: '1px solid #d9d5c8', background: '#fff', borderRadius: 14, padding: '6px 16px', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
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
                <div key={r.element_id} data-mini-card={r.element_id} style={{ border: '1px solid #e7e3d8', borderRadius: 12, background: '#fff', ...fullBox(full === r.element_id) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f7f5ef', borderRadius: full === r.element_id ? 0 : '12px 12px 0 0', flexWrap: 'wrap', ...(full === r.element_id ? { position: 'sticky', top: 0, zIndex: 3 } : {}) }}>
                    <b style={{ fontSize: 13.5 }}>{r.card}</b>
                    <StatusChip st={r.status} onPick={(k) => setStatus(r, k)} locked={!can} />
                    <PriorityTag pr={r.priority} />
                    <span style={{ flex: 1 }} />
                    <button type="button" disabled={!can} title={can ? 'Edit this issue' : 'Only the author, an editor or a manager can edit'} onClick={() => setEd(mine ? null : { element_id: r.element_id, text: r.description || '', pr: r.priority || 'noncritical' })} style={{ border: '1px solid ' + (can ? '#e8710a' : '#d9d5c8'), background: '#fff', color: can ? '#e8710a' : '#b0ab9a', borderRadius: 12, padding: '3px 12px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: can ? 'pointer' : 'not-allowed' }}>Edit</button>
                    {/^\d+$/.test(r.element_id) && <button type="button" onClick={(e) => goPart(r.element_id, e.currentTarget)} style={{ border: 0, background: 'none', font: 'inherit', fontSize: 12.5, color: '#6b675c', cursor: 'pointer' }}>{'▣'} Go to 3D</button>}
                    <FullBtn on={full === r.element_id} toggle={() => setFull(full === r.element_id ? null : r.element_id)} />
                  </div>
                  <div style={SWAP ? fsBody(full === r.element_id, wide) : bodyBox(full === r.element_id, wide)}>
                  <div style={SWAP ? fsTop(full === r.element_id, wide) : { display: 'contents' }}>
                  <div style={{ ...(SWAP ? fsHalf(full === r.element_id, wide, 'issue') : halfStyle(full === r.element_id, wide, 'issue')), background: '#fbeedb', borderTop: '3px solid #e8710a' }}>
                  {mine ? (
                    <div style={{ padding: 10 }}>
                      <textarea value={camToEdit(ed.text, cvs)} onChange={(e) => setEd({ ...ed, text: camFromEdit(e.target.value, cvs) })} rows={4} placeholder="Describe the issue…" style={{ display: 'block', width: '100%', boxSizing: 'border-box', border: '1.5px solid #e0dccf', borderRadius: 10, padding: 8, font: 'inherit', fontSize: 14, resize: 'vertical', outline: 'none' }} />
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
                    {/^\d+$/.test(r.element_id) && info('Element', linkNums(r.element_id, 'e' + r.no, true))}
                    {info('Discipline', r.discipline)}
                    {info('Asset', r.asset)}
                    {info('Created by', r.author)}
                    {info('Identified on', when(r.created_at))}
                  </div>
                  {can && (
                    <div style={{ display: 'flex', gap: 8, padding: '6px 12px', borderTop: '1px solid #efece3', background: '#f7f5ef', flexWrap: 'wrap', ...(full === r.element_id ? { justifyContent: 'space-around', padding: '10px 12px' } : {}) }}>
                      <button type="button" onClick={() => setPan({ element: r.element_id, sheet: '', cam: true })} style={{ border: '1px solid #d9d5c8', background: '#fff', borderRadius: 14, padding: '4px 11px', font: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{'\u{1F4F7}'} Add photos and videos</button>
                      <button type="button" onClick={() => setPan({ element: r.element_id, sheet: 'files' })} style={{ border: '1px solid #d9d5c8', background: '#fff', borderRadius: 14, padding: '4px 11px', font: 'inherit', fontSize: 12.5, cursor: 'pointer' }}>{'\u{1F4CE}'} Add file</button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 14, padding: '7px 12px', borderTop: '1px solid #efece3', fontSize: 12.5, ...(full === r.element_id ? { justifyContent: 'space-around', fontSize: 14, padding: '12px' } : {}) }}>
                    {[['comments', 'Comments', r.comments], ['files', 'Files', r.files], ['photos', 'Gallery', r.photos]].map(([k, l, n]) => (
                      <button key={k} type="button" onClick={() => setPan({ element: r.element_id, sheet: k })} style={{ border: 0, background: 'none', padding: 0, font: 'inherit', fontSize: 12.5, color: '#141413', cursor: 'pointer' }}>{l} <b style={{ background: n ? '#e8710a' : '#e7e3d8', color: n ? '#fff' : '#8a8576', borderRadius: 9, padding: '1px 7px', fontSize: 11.5, fontWeight: 600 }}>{n}</b></button>
                    ))}
                  </div>
                  </div>
                  <div style={SWAP ? { ...fsHalf(full === r.element_id, wide, 'ap'), background: '#eef8f0', borderTop: '3px solid #2e9e5b' } : halfStyle(full === r.element_id, wide, 'ap')}>
                  <ActionPlan job={job} r={r} can={who.can} post={apPost(r)} reload={load} forceOpen={full === r.element_id} openPan={(x) => setPan({ element: r.element_id, scope: 'ap', ...x })} />
                  </div>
                  </div>
                  {SWAP && full === r.element_id && <ModelSlot element={r.element_id} style={wide ? {} : { flex: '1.15 1 0' }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {pan && (
        // the same Comments / Files / Gallery spaces as in the part panel; the panel's own card is parked far above the screen, only its spaces (fixed to the screen) open
        <div style={{ position: 'fixed', left: 0, top: -6000, width: '100vw', zIndex: 2500 }}>
          <IssuePanel key={pan.element + pan.sheet + (pan.cam ? 'c' : '') + (pan.scope || '')} job={job} element={pan.element} scope={pan.scope || 'issue'} initialSheet={pan.sheet} autoCam={!!pan.cam} onMsg={() => {}} onClose={() => { setPan(null); load(); }} />
        </div>
      )}
      </>}
    </section>
  );
}

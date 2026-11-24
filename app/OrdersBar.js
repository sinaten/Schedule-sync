'use client';
import { useEffect, useState } from 'react';

const OR = '#e8710a';
// The six looks of a tracking status: icon, words, colours.
export const ST = {
  unknown: { l: 'Not found yet', bg: '#f1efe8', c: '#444441', ic: 'M9 9a3 3 0 1 1 4.5 2.6c-1 .6-1.5 1.1-1.5 2.4 M12 17v.01' },
  created: { l: 'Label created', bg: '#f1efe8', c: '#444441', ic: 'M12 7v5l3 2' },
  transit: { l: 'In transit', bg: '#e1effb', c: '#0c447c', ic: 'M3 7h11v9H3z M14 10h4l3 3v3h-7z' },
  out: { l: 'Out for delivery', bg: '#fff3dc', c: '#633806', ic: 'M3 8l9-5 9 5v9l-9 5-9-5z M3 8l9 5 9-5 M12 13v9' },
  delivered: { l: 'Delivered', bg: '#e4f5ea', c: '#27500a', ic: 'M5 12l5 5L20 7' },
  delayed: { l: 'Delayed', bg: '#fdecea', c: '#791f1f', ic: 'M12 4l9 16H3z M12 10v4 M12 17v.01' },
};
export const Ic = ({ d, s = 18, c = 'currentColor' }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d={d} /></svg>;
const when = (t) => { const d = new Date(t); return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
const lab = { fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: '#8a8576', textTransform: 'uppercase' };
const inp = { display: 'block', width: '100%', boxSizing: 'border-box', border: '1.5px solid #e0dccf', borderRadius: 10, padding: '7px 10px', font: 'inherit', fontSize: 14, background: '#fff' };

function Copy({ text }) {
  const [ok, setOk] = useState(false);
  const go = async () => {
    try { await navigator.clipboard.writeText(text); } catch (e) {
      try { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); } catch (x) { return; }
    }
    setOk(true); setTimeout(() => setOk(false), 1400);
  };
  return ok
    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#1e7a45' }}><Ic d="M5 12l5 5L20 7" s={14} c="#1e7a45" />Copied</span>
    : <button type="button" aria-label="Copy tracking number" title="Copy" onClick={go} style={{ border: 0, background: 'none', padding: 2, cursor: 'pointer', color: '#9a9686', lineHeight: 0 }}><Ic d="M9 9h10v11H9z M5 15V4h10" s={14} /></button>;
}


// Element numbers of an order: chips with a x, a box to paste a number and a Create button.
function ElementsField({ list, onChange }) {
  const [v, setV] = useState('');
  const make = () => { const n = v.trim().replace(/[^\w-]/g, ''); if (!n) return; if (!list.includes(n)) onChange([...list, n]); setV(''); };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
        {list.map((e) => <span key={e} style={{ background: '#e1effb', color: '#0c447c', borderRadius: 12, padding: '3px 6px 3px 10px', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{e}<button type="button" aria-label={'Remove ' + e} onClick={() => onChange(list.filter((x) => x !== e))} style={{ border: 0, background: 'none', color: '#0c447c', opacity: 0.6, cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>{'\u00D7'}</button></span>)}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); make(); } }} inputMode="numeric" placeholder="Paste the element number" style={{ ...inp, flex: 1, minWidth: 0 }} />
        {v.trim() && <button type="button" onClick={make} style={{ border: 0, borderRadius: 16, padding: '0 16px', background: OR, color: '#fff', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Create</button>}
      </div>
    </div>
  );
}

// The Orders bar: the things ordered for the job. Each card: what, who, where it is dropped off (a Scenario of the site), and the tracking number with a short status.
export default function OrdersBar({ job }) {
  const [d, setD] = useState({ orders: [], drops: [], me: '', can: false, admin: false });
  const [add, setAdd] = useState(false);
  const [f, setF] = useState({ title: '', details: '', drop: '', elements: [] });
  const [tr, setTr] = useState({});
  const [msg, setMsg] = useState('');
  const [ed, setEd] = useState(null); // the order being edited: { id, title, details, drop }
  const load = () => fetch('/api/orders?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.orders) setD(j); }).catch(() => {});
  useEffect(() => { load(); }, [job]);
  const call = async (method, body, qs) => {
    const r = await fetch('/api/orders' + (qs || ''), { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || 'Could not save.'); return false; }
    setMsg(''); return true;
  };
  const create = async () => {
    if (!f.title.trim()) { setMsg('Write what you ordered.'); return; }
    if (await call('POST', { job, ...f })) { setF({ title: '', details: '', drop: '', elements: [] }); setAdd(false); load(); }
  };
  const saveTr = async (o) => { const t = (tr[o.id] ?? o.tracking ?? '').trim(); if (t === (o.tracking || '')) return; if (await call('PATCH', { job, id: o.id, tracking: t })) { setTr((x) => { const n = { ...x }; delete n[o.id]; return n; }); load(); } };
  const saveEd = async () => {
    if (!ed.title.trim()) { setMsg('Write what you ordered.'); return; }
    if (await call('PATCH', { job, id: ed.id, title: ed.title, details: ed.details, drop: ed.drop, elements: ed.elements })) { setEd(null); load(); }
  };
  const [chk, setChk] = useState(0);
  const flip = async () => { if (await call('POST', { on: !d.agentOn }, '/agent')) load(); };
  const check = async (o) => { setChk(o.id); const ok = await call('POST', { job, id: o.id }, '/check'); setChk(0); if (ok) load(); };
  const del = async (o) => { if (await call('DELETE', null, '?job=' + encodeURIComponent(job) + '&id=' + o.id)) load(); };
  return (
    <div>
      {d.admin && <div style={{ margin: '6px 0 0', fontSize: 12.5, color: '#6f6a5a', display: 'flex', alignItems: 'center', gap: 8 }}>Tracking agent: <b style={{ color: d.agentOn ? '#2e8b57' : '#9a9686' }}>{d.agentOn ? 'On' : 'Off'}</b><button type="button" onClick={flip} style={{ border: '1px solid #d9d5c8', background: '#fff', borderRadius: 12, padding: '2px 10px', font: 'inherit', fontSize: 12, cursor: 'pointer' }}>{d.agentOn ? 'Turn off' : 'Turn on'}</button></div>}
      {d.can && !add && <div style={{ margin: '8px 0 4px' }}><button type="button" onClick={() => setAdd(true)} style={{ border: '1px solid ' + OR, background: '#fff', color: OR, borderRadius: 14, padding: '5px 14px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New</button></div>}
      {add && (
        <div style={{ margin: '8px 0', border: '1.5px solid #f0cfa3', borderRadius: 12, padding: 10, background: '#fffaf2' }}>
          <div style={lab}>What did you order</div>
          <input autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Spare part, material…" style={inp} />
          <div style={{ ...lab, marginTop: 8 }}>Notes</div>
          <textarea value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} rows={2} placeholder="Part number, quantity, anything to know" style={{ ...inp, resize: 'vertical' }} />
          <div style={{ ...lab, marginTop: 8 }}>For element</div>
          <ElementsField list={f.elements} onChange={(a) => setF({ ...f, elements: a })} />
          <div style={{ ...lab, marginTop: 8 }}>Drop-off</div>
          {d.drops.length ? (
            <select value={f.drop} onChange={(e) => setF({ ...f, drop: e.target.value })} style={inp}>
              <option value="">Choose a place</option>
              {d.drops.map((x) => <option key={x.token} value={x.token}>{x.name}</option>)}
            </select>
          ) : <div style={{ fontSize: 12.5, color: '#9a9686', marginTop: 4 }}>{d.dropWhy === 'nosite' ? 'This project is not linked to a site yet (Admin > Projects).' : 'This site has no Scenarios yet.'} {d.admin ? <a href="/admin" style={{ color: '#1a6fd4' }}>Open Admin &gt; Projects &gt; your site &gt; Scenarios</a> : 'A manager adds them in Admin.'}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={create} style={{ border: 0, borderRadius: 16, padding: '7px 20px', background: OR, color: '#fff', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>Save order</button>
            <button type="button" onClick={() => { setAdd(false); setMsg(''); }} style={{ border: '1px solid #d9d5c8', borderRadius: 16, padding: '7px 16px', background: '#fff', font: 'inherit', fontSize: 13.5, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <div style={{ color: '#c0392b', fontSize: 12.5, margin: '4px 2px' }}>{msg}</div>}
      {d.orders.length === 0 && !add && <div style={{ padding: '10px 2px', fontSize: 13, color: '#9a9686' }}>No orders yet.</div>}
      {d.orders.map((o, i) => {
        const s = ST[o.status] || ST.unknown, mine = o.author === d.me || d.admin, num = String(o.id).padStart(4, '0');
        const val = tr[o.id] ?? o.tracking ?? '';
        return (
          <div key={o.id} style={{ marginTop: 8, border: '1px solid #e7e3d8', borderRadius: 12, background: '#fff', padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: '#a86400', background: '#fff3dc', borderRadius: 5, padding: '2px 7px' }}>ORDER {num}</span>
              <b style={{ fontSize: 14.5, flex: 1, minWidth: 0 }}>{o.title}</b>
              {mine && <button type="button" aria-label="Edit order" title="Edit" onClick={() => setEd(ed && ed.id === o.id ? null : { id: o.id, title: o.title, details: o.details || '', drop: o.drop_token || '', elements: o.elements || [] })} style={{ border: 0, background: 'none', color: '#9a9686', cursor: 'pointer', padding: 2, lineHeight: 0 }}><Ic d="M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4" s={16} /></button>}
              {mine && <button type="button" aria-label="Remove order" onClick={() => del(o)} style={{ border: 0, background: 'none', color: '#9a9686', fontSize: 15, cursor: 'pointer', padding: 2 }}>{'✕'}</button>}
            </div>
            {ed && ed.id === o.id && (
              <div style={{ margin: '8px 0', border: '1.5px solid #f0cfa3', borderRadius: 10, padding: 8, background: '#fffaf2' }}>
                <div style={lab}>What did you order</div>
                <input value={ed.title} onChange={(e) => setEd({ ...ed, title: e.target.value })} style={inp} />
                <div style={{ ...lab, marginTop: 8 }}>Notes</div>
                <textarea value={ed.details} onChange={(e) => setEd({ ...ed, details: e.target.value })} rows={2} style={{ ...inp, resize: 'vertical' }} />
                <div style={{ ...lab, marginTop: 8 }}>For element</div>
                <ElementsField list={ed.elements} onChange={(a) => setEd({ ...ed, elements: a })} />
                <div style={{ ...lab, marginTop: 8 }}>Drop-off</div>
                <select value={ed.drop} onChange={(e) => setEd({ ...ed, drop: e.target.value })} style={inp}>
                  <option value="">No drop-off chosen</option>
                  {d.drops.map((x) => <option key={x.token} value={x.token}>{x.name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button type="button" onClick={saveEd} style={{ border: 0, borderRadius: 16, padding: '6px 18px', background: OR, color: '#fff', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save</button>
                  <button type="button" onClick={() => { setEd(null); setMsg(''); }} style={{ border: '1px solid #d9d5c8', borderRadius: 16, padding: '6px 14px', background: '#fff', font: 'inherit', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            )}
            {(o.elements || []).length > 0 && !(ed && ed.id === o.id) && <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>{o.elements.map((e) => <span key={e} style={{ background: '#e1effb', color: '#0c447c', borderRadius: 12, padding: '2px 9px', fontSize: 12.5, fontWeight: 600 }}>Element {e}</span>)}</div>}
            {o.details && <div style={{ fontSize: 13.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: '4px 0 0', color: '#3d3b33' }}>{o.details}</div>}
            <div style={{ fontSize: 12.5, color: '#6b675c', marginTop: 6, display: 'flex', gap: '2px 14px', flexWrap: 'wrap' }}>
              <span>Ordered by {o.author || 'admin'}</span>
              {o.drop_token ? <a href={'/scenario/' + o.drop_token} target="_blank" rel="noreferrer" style={{ color: '#1a6fd4' }}>Drop-off: {o.drop_name || 'Scenario'}</a> : <span>No drop-off chosen</span>}
              <span>{when(o.created_at)}</span>
            </div>
            {(o.phones || []).length > 0 && <div style={{ fontSize: 12.5, marginTop: 4, display: 'flex', gap: '2px 14px', flexWrap: 'wrap' }}>{o.phones.map((p, k) => <a key={k} href={'tel:' + String(p.phone).replace(/[^\d+]/g, '')} style={{ color: '#1a6fd4', textDecoration: 'none' }}>{p.name ? p.name + ': ' : ''}{p.phone}</a>)}</div>}
            <div style={{ borderTop: '1px solid #efece3', marginTop: 8, paddingTop: 8 }}>
              <div style={lab}>Tracking</div>
              {mine ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <input value={val} onChange={(e) => setTr({ ...tr, [o.id]: e.target.value })} onBlur={() => saveTr(o)} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} placeholder="Tracking number" style={{ ...inp, flex: 1, minWidth: 0 }} />
                  {o.tracking && <Copy text={o.tracking} />}
                </div>
              ) : o.tracking ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 0.2, wordBreak: 'break-all' }}>{o.tracking}</span><Copy text={o.tracking} /></div>
              ) : <div style={{ fontSize: 13, color: '#9a9686', marginTop: 4 }}>No tracking number yet.</div>}
              {o.tracking && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, background: s.bg, borderRadius: 10, padding: '8px 10px' }}>
                  <Ic d={s.ic} s={22} c={s.c} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: s.c }}>{s.l}{o.eta ? ' — arrives ' + o.eta : ''}{o.carrier ? '' : ''}</div>
                    <div style={{ fontSize: 12, color: s.c, opacity: 0.85 }}>{o.carrier ? o.carrier : 'Carrier not recognised'}{o.last_scan ? ' · ' + o.last_scan : ''}{o.checked_at ? ' · updated ' + when(o.checked_at) : o.status === 'unknown' ? ' · not checked yet' : ''}</div>
                  </div>
                  {d.can && o.status !== 'delivered' && <button type="button" onClick={() => check(o)} disabled={chk === o.id} style={{ border: '1px solid ' + s.c, background: 'rgba(255,255,255,0.6)', color: s.c, borderRadius: 14, padding: '3px 11px', font: 'inherit', fontSize: 12, cursor: 'pointer', flex: 'none' }}>{chk === o.id ? 'Checking\u2026' : 'Check now'}</button>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

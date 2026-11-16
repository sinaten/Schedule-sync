'use client';
import { useEffect, useState } from 'react';
import CamIcon from './CamIcon';

// The saved camera views of a job, in one thin bar under the 3D model.
// Nothing selected: a search box (name or number) with a short list under it, and "+ New" for admins.
// A view selected: it sits in the bar with its own buttons in front of it (no long list stays open).
export default function CamViews({ job, getCam, goCam }) {
  const [d, setD] = useState({ views: [], admin: false, editor: false, sections: [] });
  const [q, setQ] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [sel, setSel] = useState('');
  const [ren, setRen] = useState(null);
  const [msg, setMsg] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => fetch('/api/camviews?job=' + encodeURIComponent(job), { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.views) setD(j); }).catch(() => {});
  useEffect(() => { load(); }, [job]);
  // an icon inside an Issue text asks the model to go to its view
  useEffect(() => {
    const f = (e) => { const v = d.views.find((x) => x.id === (e.detail && e.detail.id)); if (v) goCam(v); };
    window.addEventListener('ss-goto-view', f);
    return () => window.removeEventListener('ss-goto-view', f);
  }, [d.views, goCam]);
  useEffect(() => { const f = () => load(); window.addEventListener('ss-camviews-changed', f); return () => window.removeEventListener('ss-camviews-changed', f); }, [job]);
  if (!d.views.length && !d.admin) return null;

  const flash = (t) => { setNote(t); setTimeout(() => setNote(''), 1500); };
  const changed = (views) => { setD((x) => ({ ...x, views })); window.dispatchEvent(new Event('ss-camviews-changed')); };
  const call = async (method, body, qs) => {
    const r = await fetch('/api/camviews' + (qs || ''), { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || 'Could not save.'); return null; }
    setMsg(''); return j;
  };
  const v = d.views.find((x) => x.id === sel) || null;
  const sorted = d.views.slice().sort((x, y) => (x.n || 0) - (y.n || 0));
  const ql = q.trim().toLowerCase();
  const shown = sorted.filter((x) => !ql || (x.n + ' ' + x.name).toLowerCase().includes(ql));

  function pick(x) { setSel(x.id); setQ(''); setListOpen(false); setRen(null); setMsg(''); goCam(x); }
  function clear() { setSel(''); setRen(null); setMsg(''); }

  // + New: a new camera row at the angle the model shows now, with the name ready to be typed
  async function addNew() {
    const cam = getCam();
    if (!cam) { setMsg('The model is not ready yet.'); return; }
    const used = new Set(d.views.map((x) => x.name.toLowerCase()));
    let k = d.views.reduce((m, x) => Math.max(m, x.n || 0), 0) + 1;
    while (used.has(('View ' + k).toLowerCase())) k++;
    const name = 'View ' + k;
    setBusy(true);
    const j = await call('POST', { job, name, icon: 'camera', cam, view: window.__ssView || '' });
    setBusy(false);
    if (!j) return;
    changed(j.views);
    const nv = j.views.find((x) => x.name === name);
    if (nv) { setSel(nv.id); setRen({ id: nv.id, t: nv.name }); setQ(''); setListOpen(false); }
  }
  async function saveName() {
    if (!ren || !v) return;
    const t = ren.t.trim();
    if (!t || t === v.name) { setRen(null); return; }
    const j = await call('PATCH', { job, id: v.id, name: t });
    if (j) { changed(j.views); setRen(null); }
  }
  async function del() {
    if (!window.confirm('Delete the view "' + v.name + '"? Issues that use it lose the icon.')) return;
    const j = await call('DELETE', null, '?job=' + encodeURIComponent(job) + '&id=' + encodeURIComponent(v.id));
    if (j) { changed(j.views); clear(); }
  }
  async function genQr() {
    setBusy(true);
    const j = await call('POST', { job, action: 'qr', id: v.id });
    setBusy(false);
    if (j) { changed(j.views); flash('QR made'); }
  }
  async function copyQr() {
    const url = location.origin + '/cv/' + v.qr;
    try {
      const { camQrPng } = await import('../lib/camqrimg');
      const png = await camQrPng(url, v.n, v.name);
      const blob = await (await fetch(png)).blob();
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
      flash('QR image copied');
    } catch (e) {
      try { await navigator.clipboard.writeText(url); flash('QR link copied'); } catch (e2) { flash('Could not copy'); }
    }
  }
  async function copyCode() {
    const t = '[[view:' + v.id + ']]';
    try { await navigator.clipboard.writeText(t); } catch (e) {
      const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e2) { /* ignore */ } a.remove();
    }
    flash('Code copied');
  }

  const mini = { border: '1px solid #d9d5c8', borderRadius: 8, background: '#fff', font: 'inherit', fontSize: 12.5, fontWeight: 600, padding: '4px 9px', cursor: 'pointer', color: '#141413', flex: 'none' };
  const field = { height: 32, boxSizing: 'border-box', border: '1.5px solid #e0dccf', borderRadius: 16, padding: '0 12px', font: 'inherit', fontSize: 13 };
  return (
    <div style={{ padding: '6px 12px 8px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', position: 'relative' }}>
      {!v && (
        <span style={{ position: 'relative', flex: '1 1 200px', minWidth: 160, maxWidth: 360 }}>
          <input value={q} onChange={(e) => { setQ(e.target.value); setListOpen(true); }} onFocus={() => setListOpen(true)} onBlur={() => setTimeout(() => setListOpen(false), 160)}
            placeholder={d.views.length ? 'Saved views (' + d.views.length + ') - search name or number' : 'No saved views yet'} disabled={!d.views.length}
            style={{ ...field, width: '100%' }} />
          {listOpen && d.views.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, top: '110%', maxHeight: 240, overflowY: 'auto', background: '#fff', border: '1px solid #efece3', borderRadius: 12, boxShadow: '0 6px 24px rgba(0,0,0,.22)', zIndex: 30 }}>
              {!shown.length && <div style={{ padding: '10px 14px', fontSize: 13, color: '#8a8576' }}>No view found.</div>}
              {shown.map((x) => (
                <button key={x.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(x)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #f1ede4', background: '#fff', padding: '9px 14px', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#141413' }}>
                  <span style={{ fontSize: 16, flex: 'none' }}><CamIcon n={x.n} /></span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</span>
                  {x.qr && <span style={{ flex: 'none', fontSize: 11, color: '#1b5e20', marginLeft: 'auto' }}>QR</span>}
                </button>
              ))}
            </div>
          )}
        </span>
      )}
      {v && (
        <>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1.5px solid #e8710a', background: '#fff4e8', borderRadius: 16, padding: '2px 10px', minHeight: 32, boxSizing: 'border-box', fontSize: 14, fontWeight: 700, color: '#141413', maxWidth: '100%' }}>
            <span style={{ fontSize: 16, flex: 'none' }}><CamIcon n={v.n} /></span>
            {ren && ren.id === v.id ? (
              <input autoFocus value={ren.t} onChange={(e) => setRen({ id: v.id, t: e.target.value })} maxLength={60}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); else if (e.key === 'Escape') setRen(null); }} onBlur={saveName}
                style={{ height: 26, width: 150, boxSizing: 'border-box', border: '1px solid #e8710a', borderRadius: 8, padding: '0 8px', font: 'inherit', fontSize: 14 }} />
            ) : <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>}
          </span>
          {d.admin && !(ren && ren.id === v.id) && <button type="button" style={mini} onClick={() => setRen({ id: v.id, t: v.name })}>{'✎'} Edit</button>}
          {d.editor && <button type="button" style={mini} onClick={copyCode} title="Copy the code to paste into an Issue text">Copy code</button>}
          {d.admin && (v.qr
            ? <button type="button" style={{ ...mini, borderColor: '#2e7d32', background: '#edf7ee', color: '#1b5e20' }} onClick={copyQr}>Copy QR</button>
            : <button type="button" style={mini} onClick={genQr} disabled={busy}>Generate QR</button>)}
          {d.admin && <button type="button" aria-label={'Delete ' + v.name} style={{ ...mini, color: '#b3402a' }} onClick={del}>{'✕'}</button>}
          <button type="button" style={{ ...mini, borderColor: 'transparent', background: 'transparent', color: '#6b6757' }} onClick={clear}>Done</button>
        </>
      )}
      {d.admin && !v && <button type="button" style={{ ...mini, borderColor: '#e8710a', color: '#e8710a', height: 32, borderRadius: 16, padding: '0 14px', fontSize: 13 }} onClick={addNew} disabled={busy}>+ New</button>}
      {(msg || note) && <span style={{ fontSize: 12.5, color: msg ? '#b3402a' : '#1b5e20' }}>{msg || note}</span>}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import CamIcon from './CamIcon';

// The saved camera views of a job, under the 3D model. Everyone sees them and one touch moves the camera there.
// An admin can also make a new one from where the camera stands now, give it a unique name and an icon, and delete it.
export default function CamViews({ job, getCam, goCam }) {
  const [d, setD] = useState({ views: [], admin: false, editor: false });
  const [form, setForm] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [ren, setRen] = useState(null);
  const [pick, setPick] = useState(null);
  const [copied, setCopied] = useState('');
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
  async function save() {
    const cam = getCam();
    if (!cam) { setMsg('The model is not ready yet.'); return; }
    const r = await fetch('/api/camviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, name, icon: 'camera', cam, view: window.__ssView || '' }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || 'Could not save.'); return; }
    setD((x) => ({ ...x, views: j.views })); setForm(false); setName(''); setMsg('');
    window.dispatchEvent(new Event('ss-camviews-changed'));
  }
  async function del(v) {
    if (!window.confirm('Delete the view "' + v.name + '"? Issues that use it lose the icon.')) return;
    const r = await fetch('/api/camviews?job=' + encodeURIComponent(job) + '&id=' + encodeURIComponent(v.id), { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setD((x) => ({ ...x, views: j.views })); window.dispatchEvent(new Event('ss-camviews-changed')); }
  }
  async function patch(v, body) {
    const r = await fetch('/api/camviews', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, id: v.id, ...body }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || 'Could not save.'); return false; }
    setMsg(''); setD((x) => ({ ...x, views: j.views })); window.dispatchEvent(new Event('ss-camviews-changed')); return true;
  }
  async function copy(v) {
    const t = '[[view:' + v.id + ']]';
    try { await navigator.clipboard.writeText(t); } catch (e) {
      const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e2) { /* ignore */ } a.remove();
    }
    setCopied(v.id); setTimeout(() => setCopied(''), 1200);
  }
  const ql = q.trim().toLowerCase();
  const shown = d.views.slice().sort((x, y) => (x.n || 0) - (y.n || 0)).filter((v) => !ql || (v.n + ' ' + v.name).toLowerCase().includes(ql));
  const mini = { border: '1px solid #d9d5c8', borderRadius: 8, background: '#fff', font: 'inherit', fontSize: 12, padding: '3px 8px', cursor: 'pointer', color: '#141413', flex: 'none' };
  const chip = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: '1.5px solid #d9d5c8', borderRadius: 18, background: '#fff', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#141413' };
  return (
    <div style={{ padding: '6px 12px 8px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', position: 'relative' }}>
      {d.views.length > 0 && (
        <span style={{ position: 'relative', display: 'inline-block' }}>
          <button type="button" style={chip} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <CamIcon n="" /> Saved views <span style={{ color: '#8a8576', fontWeight: 500 }}>({d.views.length})</span> <span style={{ fontSize: 11, color: '#8a8576' }}>{open ? '\u25B4' : '\u25BE'}</span>
          </button>
          {open && (
            <div style={{ position: 'absolute', left: 0, top: '110%', minWidth: 300, maxWidth: '92vw', maxHeight: 420, overflowY: 'auto', background: '#fff', border: '1px solid #efece3', borderRadius: 14, boxShadow: '0 6px 24px rgba(0,0,0,.22)', zIndex: 30 }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1ede4' }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or number" style={{ width: '100%', boxSizing: 'border-box', height: 32, border: '1.5px solid #e0dccf', borderRadius: 16, padding: '0 12px', font: 'inherit', fontSize: 13 }} />
              </div>
              {!shown.length && <div style={{ padding: '10px 14px', fontSize: 13, color: '#8a8576' }}>No view found.</div>}
              {shown.map((v) => (
                <div key={v.id} style={{ borderBottom: '1px solid #f1ede4' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: 8 }}>
                    {ren && ren.id === v.id ? (
                      <input autoFocus value={ren.t} onChange={(e) => setRen({ id: v.id, t: e.target.value })} maxLength={60}
                        onKeyDown={async (e) => { if (e.key === 'Enter') { if (await patch(v, { name: ren.t })) setRen(null); } else if (e.key === 'Escape') setRen(null); }}
                        onBlur={async () => { if (ren && ren.t.trim() && ren.t.trim() !== v.name) await patch(v, { name: ren.t }); setRen(null); }}
                        style={{ flex: 1, minWidth: 0, margin: '6px 0 6px 10px', height: 30, boxSizing: 'border-box', border: '1.5px solid #e8710a', borderRadius: 8, padding: '0 8px', font: 'inherit', fontSize: 14 }} />
                    ) : (
                      <button type="button" onClick={() => { goCam(v); setOpen(false); }} title={v.name} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', border: 0, background: '#fff', padding: '10px 6px 10px 14px', font: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#141413', minWidth: 0 }}>
                        <span style={{ fontSize: 16, flex: 'none' }}><CamIcon n={v.n} /></span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                      </button>
                    )}
                    {d.admin && !(ren && ren.id === v.id) && <button type="button" aria-label={'Rename ' + v.name} onClick={() => setRen({ id: v.id, t: v.name })} style={{ border: 0, background: 'none', cursor: 'pointer', fontSize: 14, color: '#8a8576', padding: '0 2px', flex: 'none' }}>{'\u270E'}</button>}
                    {d.editor && <button type="button" onClick={() => copy(v)} style={mini}>{copied === v.id ? 'Copied' : 'Copy'}</button>}
                    {d.admin && (v.qr
                      ? <button type="button" onClick={() => patch(v, { qr: '' })} title="Disconnect this QR" style={{ ...mini, borderColor: '#2e7d32', background: '#edf7ee', color: '#1b5e20' }}>QR {v.qrName || ''} {'\u2715'}</button>
                      : <button type="button" onClick={() => setPick(pick === v.id ? null : v.id)} style={{ ...mini, borderStyle: 'dashed', color: '#6b6757' }}>+ QR</button>)}
                    {d.admin && <button type="button" aria-label={'Delete ' + v.name} onClick={() => del(v)} style={{ border: 0, background: 'none', color: '#b3402a', cursor: 'pointer', fontSize: 14, padding: '0 4px', flex: 'none' }}>{'\u2715'}</button>}
                  </div>
                  {pick === v.id && (
                    <div style={{ padding: '4px 12px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(d.sections || []).length === 0 && <span style={{ fontSize: 12.5, color: '#8a8576' }}>No QR codes made for this job yet.</span>}
                      {(d.sections || []).map((s) => <button key={s.id} type="button" style={mini} onClick={async () => { if (await patch(v, { qr: s.id })) setPick(null); }}>{s.name}</button>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </span>
      )}
      {d.admin && !form && <button type="button" style={{ ...chip, borderColor: '#e8710a', color: '#e8710a' }} onClick={() => setForm(true)}>+ New view</button>}
      {d.admin && form && (
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Unique name" maxLength={60} style={{ height: 32, boxSizing: 'border-box', border: '1.5px solid #e0dccf', borderRadius: 16, padding: '0 12px', font: 'inherit', fontSize: 13 }} />
          <button type="button" style={{ ...chip, background: '#e8710a', borderColor: '#e8710a', color: '#fff' }} onClick={save} disabled={!name.trim()}>Save this angle</button>
          <button type="button" style={chip} onClick={() => { setForm(false); setMsg(''); }}>Cancel</button>
        </span>
      )}
      {msg && <span style={{ fontSize: 12.5, color: '#b3402a' }}>{msg}</span>}
    </div>
  );
}

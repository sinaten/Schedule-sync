'use client';
import { useEffect, useState } from 'react';
import IdCatalog from './IdCatalog';

// Admin: how the site builds an ID (order, parts on / off, separator, short codes). Collapsed to one small button. Only builds samples for now: no card uses it yet.
export default function IdFormat() {
  const [f, setF] = useState(null);
  const [parts, setParts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [job, setJob] = useState('');
  const [sample, setSample] = useState('');
  const [from, setFrom] = useState('');
  const [nPend, setNPend] = useState(0);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetch('/api/admin/id-format', { cache: 'no-store' }).then((r) => r.json()).then((j) => { setF(j.format); setParts(j.parts || []); }).catch(() => setMsg('Could not load'));
    fetch('/api/admin/id-catalog?count=1', { cache: 'no-store' }).then((r) => r.json()).then((j) => setNPend(j.pending || 0)).catch(() => {});
    fetch('/api/admin/jobs', { cache: 'no-store' }).then((r) => r.json()).then((j) => { const l = (j.jobs || []).map((x) => x.job); setJobs(l); if (l[0]) setJob(l[0]); }).catch(() => {});
  }, []);
  async function make(fmt) {
    try { const r = await fetch('/api/admin/id-format', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, format: fmt }) }); const j = await r.json(); setSample(j.id || ''); setFrom(j.from || ''); } catch (e) { setSample(''); }
  }
  useEffect(() => { if (f && job) make(f); }, [job, f]);
  async function save() {
    setMsg('Saving…');
    const r = await fetch('/api/admin/id-format', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ format: f }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setF(j.format); setMsg('Saved'); setTimeout(() => setMsg(''), 1500); } else setMsg(j.error || 'Failed');
  }
  if (!f) return <p className="muted" style={{ fontSize: 13 }}>{msg || 'Loading…'}</p>;
  const pill = { font: 'inherit', fontSize: 13, padding: '5px 12px', borderRadius: 999, border: '1px solid #d5dce0', background: '#fff', color: '#45565e', cursor: 'pointer' };
  const field = { padding: '5px 8px', fontSize: 13, borderRadius: 8, border: '1px solid #d5dce0', background: '#fff', boxSizing: 'border-box' };
  const move = (i, d) => { const s = f.segs.slice(); const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; setF({ ...f, segs: s }); };
  const name = (k) => (parts.find((p) => p.k === k) || {}).n || k;
  const hint = (k) => (parts.find((p) => p.k === k) || {}).h || '';
  return (
    <div style={{ marginTop: 18, border: '1px solid #e6eaed', borderRadius: 12, background: '#fff', maxWidth: 640, overflow: 'hidden' }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} style={{ font: 'inherit', display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', color: '#16262e' }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>Tracking IDs{nPend > 0 && <span style={{ marginLeft: 8, background: '#d64545', color: '#fff', borderRadius: 999, fontSize: 12, fontWeight: 600, padding: '1px 8px' }} aria-label={nPend + ' new things found'}>{nPend}</span>}</span>
        {!open && <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: '#8a979d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{sample}</span>}
        <span style={{ fontSize: 14, color: '#45565e' }}>{open ? '\u25B4' : '\u25BE'}</span>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #e6eaed', padding: '10px 14px', background: '#fafbfc' }}>
          <div style={{ fontSize: 12, color: '#8a979d', marginBottom: 4 }}>Sample (not stored)</div>
          <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 16, fontWeight: 600, color: '#16262e', wordBreak: 'break-all', marginBottom: 2 }}>{sample || '…'}</div>
          <div style={{ fontSize: 12, color: from === 'none' ? '#b00020' : '#8a979d', marginBottom: 6 }}>{from === 'gps' ? 'Country, state and city read from the map pin' : from === 'text' ? 'No map pin found: using the typed country, city and address' : from === 'none' ? 'This project has no location yet (Admin > Projects)' : ''}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#45565e', flexWrap: 'wrap', marginBottom: 8 }}>
            <span>for project</span>
            <select value={job} onChange={(e) => setJob(e.target.value)} style={{ ...field, maxWidth: 200 }}>{jobs.map((j) => <option key={j} value={j}>{j}</option>)}</select>
            <span>separator</span>
            <input value={f.sep} maxLength={3} onChange={(e) => setF({ ...f, sep: e.target.value })} style={{ ...field, width: 44, textAlign: 'center' }} />
          </div>
          {f.segs.map((s, i) => (
            <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: '1px solid #eef1f3', fontSize: 13, color: '#16262e' }}>
              <span style={{ width: 18, color: '#8a979d' }}>{i + 1}</span>
              <input type="checkbox" checked={s.on} onChange={(e) => setF({ ...f, segs: f.segs.map((x) => (x.k === s.k ? { ...x, on: e.target.checked } : x)) })} aria-label={'Use ' + name(s.k)} />
              <span style={{ width: 64 }}>{name(s.k)}</span>
              <span style={{ flex: 1, fontSize: 12, color: '#8a979d' }}>{hint(s.k)}</span>
              <button type="button" style={{ ...pill, padding: '1px 8px' }} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button type="button" style={{ ...pill, padding: '1px 8px' }} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            </div>
          ))}
          <label style={{ display: 'block', marginTop: 10, fontSize: 13, color: '#45565e' }}>
            Short codes (one per line, name = code)
            <textarea value={f.codes} onChange={(e) => setF({ ...f, codes: e.target.value })} rows={3} placeholder={'Columbus=COL\nUnited States=US'} style={{ ...field, width: '100%', marginTop: 3, fontFamily: 'inherit' }} />
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8, fontSize: 13, color: '#45565e' }}>
            <input type="checkbox" checked={f.show} onChange={(e) => setF({ ...f, show: e.target.checked })} />
            Show a tiny grey ID under each item (not applied anywhere yet)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button type="button" onClick={save} style={{ ...pill, background: '#16262e', color: '#fff', border: 0 }}>Save</button>
            {msg && <b style={{ fontSize: 12, color: msg === 'Saved' ? '#2e7d32' : '#b00020' }}>{msg}</b>}
          </div>
          <IdCatalog job={job} base={f} onCount={setNPend} />
        </div>
      )}
    </div>
  );
}

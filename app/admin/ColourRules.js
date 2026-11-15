'use client';
import { useEffect, useMemo, useState } from 'react';

const OPS = [['equals', 'is'], ['notequals', 'is not'], ['greater', '>'], ['greaterorequal', '≥'], ['less', '<'], ['lessorequal', '≤'], ['contains', 'contains'], ['beginswith', 'begins with'], ['endswith', 'ends with']];
const opKey = (l) => { const o = String(l.op || 'equals').replace(/^Filter(Numeric|String)?/i, '').toLowerCase() || 'equals'; return (o === 'equals' && l.not) ? 'notequals' : o; };
const showVal = (l) => (l.kind === 'int' && (l.value === 1 || l.value === 0) ? (l.value ? 'Yes' : 'No') : l.value === null || l.value === undefined ? '' : String(l.value));
function parseVal(t) { const s = String(t).trim(); if (/^yes$/i.test(s)) return { value: 1, kind: 'int' }; if (/^no$/i.test(s)) return { value: 0, kind: 'int' }; if (s !== '' && !Number.isNaN(Number(s))) return { value: Number(s), kind: 'number' }; return { value: s, kind: 'text' }; }
const inp = { padding: '6px 8px', fontSize: 14, border: '1px solid #cfd8dc', borderRadius: 6, background: '#fff' };
const btn = { padding: '6px 12px', fontSize: 13, fontWeight: 600, border: '1px solid #cfd8dc', borderRadius: 16, background: '#fff', cursor: 'pointer' };

export default function ColourRules() {
  const [jobs, setJobs] = useState([]);
  const [job, setJob] = useState('');
  const [rules, setRules] = useState(null);
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => { fetch('/api/admin/jobs', { cache: 'no-store' }).then((r) => r.json()).then((j) => { const l = (j.jobs || []).filter((x) => x.state !== 'deleted'); setJobs(l); if (l[0]) setJob(l[0].job); }).catch(() => {}); }, []);
  async function load(j) {
    setRules(null); setMsg(''); setDirty(false);
    if (!j) return;
    try { const r = await fetch('/api/colorrules?job=' + encodeURIComponent(j), { cache: 'no-store' }).then((x) => x.json()); setRules(r.rules || { filters: [] }); if (!r.rules) setMsg('Revit has not sent any colour filters for this job yet. Publish 3D once from Revit, or add filters here.'); } catch (e) { setMsg('Could not load.'); }
  }
  useEffect(() => { load(job); }, [job]);

  const params = useMemo(() => { const s = new Set(); const walk = (t) => (t && t.items || []).forEach((i) => (i.items ? walk(i) : i.param && s.add(i.param))); (rules?.filters || []).forEach((f) => walk(f.tree)); return [...s].sort(); }, [rules]);
  const upd = (fn) => { setRules((r) => { const n = JSON.parse(JSON.stringify(r)); fn(n); return n; }); setDirty(true); };

  async function save() {
    setMsg('Saving…');
    const r = await fetch('/api/colorrules', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, rules }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setDirty(false); setMsg('Saved. The model colours follow these rules.'); } else setMsg(j.error || 'Could not save.');
  }
  async function reimport() {
    if (!confirm('Copy the colour filters from Revit again? The rules edited here are replaced.')) return;
    const r = await fetch('/api/colorrules', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, action: 'import' }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setRules(j.rules); setDirty(false); setMsg('Copied from Revit.'); } else setMsg(j.error || 'Could not copy.');
  }

  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>Colour rules</h2>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: '#546e7a' }}>The first filter whose conditions are all true gives the part its colour. Put the most important filter on top. Parts that match no filter stay grey.</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={job} onChange={(e) => { if (dirty && !confirm('Leave without saving?')) return; setJob(e.target.value); }} style={inp}>{jobs.map((j) => <option key={j.job} value={j.job}>{j.job}</option>)}</select>
        <button type="button" style={{ ...btn, background: dirty ? '#16262e' : '#fff', color: dirty ? '#fff' : '#16262e' }} onClick={save} disabled={!rules}>Save</button>
        <button type="button" style={btn} onClick={reimport} disabled={!job}>Copy again from Revit</button>
        {msg && <span style={{ fontSize: 13, color: '#455a64' }}>{msg}</span>}
      </div>
      <datalist id="cr-params">{params.map((p) => <option key={p} value={p} />)}</datalist>
      <datalist id="cr-vals"><option value="Yes" /><option value="No" /></datalist>
      {(rules?.filters || []).map((f, i) => (
        <div key={f.id || i} style={{ border: '1px solid #cfd8dc', borderRadius: 10, padding: 12, marginBottom: 10, background: f.enabled === false ? '#f5f5f5' : '#fff' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: '#78909c', minWidth: 20 }}>{i + 1}</span>
            <input type="checkbox" checked={f.enabled !== false} onChange={(e) => upd((r) => { r.filters[i].enabled = e.target.checked; })} aria-label="On" />
            <input type="color" value={'#' + String(f.color || '808080').slice(0, 6)} onChange={(e) => upd((r) => { r.filters[i].color = e.target.value.slice(1); })} style={{ width: 40, height: 32, border: 'none', background: 'none', padding: 0 }} aria-label="Colour" />
            <input value={f.name} onChange={(e) => upd((r) => { r.filters[i].name = e.target.value; })} style={{ ...inp, flex: '1 1 160px', fontWeight: 600 }} />
            <select value={f.tree?.logic === 'or' ? 'or' : 'and'} onChange={(e) => upd((r) => { r.filters[i].tree.logic = e.target.value; })} style={inp}><option value="and">all true (AND)</option><option value="or">any true (OR)</option></select>
            <button type="button" style={btn} onClick={() => upd((r) => { if (i > 0) { const [x] = r.filters.splice(i, 1); r.filters.splice(i - 1, 0, x); } })} aria-label="Move up">↑</button>
            <button type="button" style={btn} onClick={() => upd((r) => { if (i < r.filters.length - 1) { const [x] = r.filters.splice(i, 1); r.filters.splice(i + 1, 0, x); } })} aria-label="Move down">↓</button>
            <button type="button" style={{ ...btn, color: '#c62828' }} onClick={() => { if (confirm('Delete the filter ' + f.name + '?')) upd((r) => { r.filters.splice(i, 1); }); }}>Delete</button>
          </div>
          <div style={{ marginTop: 8, paddingLeft: 28 }}>
            {(f.tree?.items || []).map((l, k) => l.items ? (
              <div key={k} style={{ fontSize: 13, color: '#78909c', margin: '4px 0' }}>(a group of {l.items.length} conditions made in Revit, kept as it is)</div>
            ) : (
              <div key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', margin: '4px 0', flexWrap: 'wrap' }}>
                <input list="cr-params" value={l.param || ''} onChange={(e) => upd((r) => { r.filters[i].tree.items[k].param = e.target.value; })} style={{ ...inp, flex: '1 1 200px' }} placeholder="Parameter" />
                <select value={opKey(l)} onChange={(e) => upd((r) => { const x = r.filters[i].tree.items[k]; const v = e.target.value; x.not = v === 'notequals'; x.op = v === 'notequals' ? 'equals' : v; })} style={inp}>{OPS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
                <input list="cr-vals" value={showVal(l)} onChange={(e) => upd((r) => { Object.assign(r.filters[i].tree.items[k], parseVal(e.target.value)); })} style={{ ...inp, width: 110 }} placeholder="Value" />
                <button type="button" style={btn} onClick={() => upd((r) => { r.filters[i].tree.items.splice(k, 1); })} aria-label="Remove condition">✕</button>
              </div>
            ))}
            <button type="button" style={{ ...btn, marginTop: 4 }} onClick={() => upd((r) => { const t = r.filters[i].tree; t.items = [...(t.items || []), { param: '', op: 'equals', value: 1, kind: 'int' }]; })}>+ Condition</button>
          </div>
        </div>
      ))}
      {rules && <button type="button" style={btn} onClick={() => upd((r) => { r.filters.push({ id: 'n' + Date.now(), name: 'New filter', color: '808080', enabled: true, cats: [], tree: { logic: 'and', items: [] } }); })}>+ Filter</button>}
    </div>
  );
}

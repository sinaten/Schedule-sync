'use client';
import { useEffect, useState } from 'react';

// Inside Tracking IDs: every kind of thing that gets an ID (items, buttons, bars), a live sample of each, editable parts, page codes,
// and the new buttons the site found that the catalog does not know yet (approve or dismiss).
export default function IdCatalog({ job, base, onCount }) {
  const [d, setD] = useState(null);
  const [cat, setCat] = useState(null);
  const [pend, setPend] = useState([]);
  const [samples, setSamples] = useState({});
  const [edit, setEdit] = useState('');
  const [acts, setActs] = useState({});
  const [msg, setMsg] = useState('');
  const [mode, setMode] = useState('');
  const [chkRes, setChkRes] = useState(null);
  const [chkBusy, setChkBusy] = useState(false);
  const [chk, setChk] = useState({});
  const load = () => fetch('/api/admin/id-catalog', { cache: 'no-store' }).then((r) => r.json()).then((j) => { setD(j); setCat(j.catalog); setPend(j.pending || []); if (onCount) onCount((j.pending || []).length); }).catch(() => setMsg('Could not load'));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!cat || !job) return undefined;
    const t = setTimeout(() => {
      fetch('/api/admin/id-catalog', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, catalog: cat, format: base }) }).then((r) => r.json()).then((j) => setSamples(j.samples || {})).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [cat, job, base]);
  if (!cat) return <p className="muted" style={{ fontSize: 13 }}>{msg || 'Loading…'}</p>;
  const pill = { font: 'inherit', fontSize: 12, padding: '3px 10px', borderRadius: 999, border: '1px solid #d5dce0', background: '#fff', color: '#45565e', cursor: 'pointer' };
  const field = { padding: '4px 7px', fontSize: 13, borderRadius: 8, border: '1px solid #d5dce0', background: '#fff', boxSizing: 'border-box' };
  const mono = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: '#16262e', wordBreak: 'break-all' };
  const tname = (k) => ((d.tokens || []).find((x) => x.k === k) || {}).n || k;
  const upd = (key, patch) => setCat({ ...cat, types: cat.types.map((t) => (t.key === key ? { ...t, ...patch } : t)) });
  const move = (t, i, dir) => { const p = t.parts.slice(); const j = i + dir; if (j < 0 || j >= p.length) return; [p[i], p[j]] = [p[j], p[i]]; upd(t.key, { parts: p }); };
  async function save() {
    setMsg('Saving…');
    const r = await fetch('/api/admin/id-catalog', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ catalog: cat }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setCat(j.catalog); setMsg('Saved'); setTimeout(() => setMsg(''), 1500); } else setMsg(j.error || 'Failed');
  }
  async function answer(it, op) {
    await fetch('/api/admin/id-catalog', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key: it.key, op, action: acts[it.key] }) });
    load();
  }
  function pickMode(m) { setMode(m); const c = {}; if (m) pend.forEach((x) => { c[x.key] = true; }); setChk(c); }
  async function applyMode() {
    const keys = pend.filter((x) => chk[x.key]).map((x) => x.key);
    if (!keys.length) { setMode(''); return; }
    await fetch('/api/admin/id-catalog', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ keys, op: mode, actions: acts }) });
    setMode(''); setChk({}); load();
  }
  async function runCheck() {
    setChkBusy(true); setChkRes(null);
    try { const r = await fetch('/api/admin/id-check', { cache: 'no-store' }); setChkRes(await r.json()); } catch (e) { setChkRes({ error: 'Check failed' }); }
    setChkBusy(false);
  }
  const nChk = pend.filter((x) => chk[x.key]).length;
  const groups = [['item', 'Items (each one gets its own number)'], ['message', 'Messages in Communication (who, when, what kind)'], ['button', 'Buttons'], ['bar', 'Bars and tabs']];
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid #e6eaed', paddingTop: 10 }}>
      {pend.length > 0 && (
        <div style={{ border: '1px solid #f1c9a8', background: '#fff6ee', borderRadius: 10, padding: '8px 10px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#9a4b0c', marginBottom: 4 }}>{pend.length} new thing{pend.length > 1 ? 's' : ''} found</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
            <select value={mode} onChange={(e) => pickMode(e.target.value)} style={{ ...field, width: 'auto' }} aria-label="Choose what to do with all of them">
              <option value="">Normal (one by one)</option>
              <option value="approve">Approve all</option>
              <option value="dismiss">Dismiss all</option>
            </select>
            {mode && <button type="button" style={{ ...pill, background: mode === 'approve' ? '#16262e' : '#b00020', color: '#fff', border: 0 }} onClick={applyMode}>{'OK: ' + (mode === 'approve' ? 'approve ' : 'dismiss ') + nChk}</button>}
            {mode && <button type="button" style={pill} onClick={() => pickMode('')}>Cancel</button>}
            {mode && <span style={{ fontSize: 12, color: '#6b675c' }}>Untick the ones you do not want, then press OK.</span>}
          </div>
          <div style={{ fontSize: 12, color: '#6b675c', marginBottom: 6 }}>These buttons are on the site but not in the list below. My suggestion: add each as a button type, with the action name shown. Approve to add it, or dismiss.</div>
          {pend.slice(0, mode ? 300 : 25).map((it) => (
            <div key={it.key} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0', flexWrap: 'wrap', fontSize: 13 }}>
              {mode && <input type="checkbox" checked={!!chk[it.key]} onChange={(e) => setChk({ ...chk, [it.key]: e.target.checked })} aria-label={'Include ' + it.label} />}
              <b style={{ minWidth: 110 }}>{it.label}</b>
              <span style={{ fontSize: 12, color: '#8a979d' }}>on {it.page}</span>
              <input style={{ ...field, width: 150, fontFamily: 'ui-monospace, Menlo, monospace' }} value={acts[it.key] ?? it.suggest} onChange={(e) => setActs({ ...acts, [it.key]: e.target.value })} aria-label="Action name" />
              {!mode && <button type="button" style={{ ...pill, background: '#16262e', color: '#fff', border: 0 }} onClick={() => answer(it, 'approve')}>Approve</button>}
              {!mode && <button type="button" style={pill} onClick={() => answer(it, 'dismiss')}>Dismiss</button>}
            </div>
          ))}
          {!mode && pend.length > 25 && <div style={{ fontSize: 12, color: '#8a979d' }}>and {pend.length - 25} more</div>}
        </div>
      )}
      {groups.map(([g, title]) => (
        <div key={g} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#16262e', marginBottom: 4 }}>{title}</div>
          {cat.types.filter((t) => t.group === g).map((t) => (
            <div key={t.key} style={{ borderTop: '1px solid #eef1f3', padding: '6px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: '#16262e', flex: 1 }}>{t.name}{t.added ? ' (new)' : ''}<span style={{ display: 'block', fontSize: 11.5, color: '#8a979d' }}>{t.desc}</span></span>
                <button type="button" style={pill} onClick={() => setEdit(edit === t.key ? '' : t.key)} aria-expanded={edit === t.key}>{edit === t.key ? 'Close' : 'Edit'}</button>
              </div>
              <div style={mono}>{samples[t.key] || '…'}</div>
              {edit === t.key && (
                <div style={{ marginTop: 6, padding: '6px 8px', background: '#fff', border: '1px solid #e6eaed', borderRadius: 8 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: '#45565e', marginBottom: 6 }}>
                    {t.group === 'item' ? <label>Type code <input style={{ ...field, width: 70 }} value={t.code} onChange={(e) => upd(t.key, { code: e.target.value })} /></label> : (
                      <>
                        <label>Kind <input style={{ ...field, width: 70 }} value={t.word} onChange={(e) => upd(t.key, { word: e.target.value })} /></label>
                        <label>Action <input style={{ ...field, width: 170, fontFamily: 'ui-monospace, Menlo, monospace' }} value={t.action} onChange={(e) => upd(t.key, { action: e.target.value })} /></label>
                      </>
                    )}
                  </div>
                  {t.parts.map((x, i) => (
                    <div key={x.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 13 }}>
                      <input type="checkbox" checked={x.on} onChange={(e) => upd(t.key, { parts: t.parts.map((y) => (y.k === x.k ? { ...y, on: e.target.checked } : y)) })} aria-label={'Use ' + tname(x.k)} />
                      <span style={{ width: 70 }}>{tname(x.k)}</span>
                      <span style={{ flex: 1, fontSize: 12, color: '#8a979d' }}>{((d.tokens || []).find((k) => k.k === x.k) || {}).h}</span>
                      <button type="button" style={{ ...pill, padding: '0 8px' }} onClick={() => move(t, i, -1)} aria-label="Move up">↑</button>
                      <button type="button" style={{ ...pill, padding: '0 8px' }} onClick={() => move(t, i, 1)} aria-label="Move down">↓</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      <div style={{ border: '1px solid #e6eaed', borderRadius: 10, padding: '8px 10px', marginBottom: 12, background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" style={{ ...pill, fontSize: 13, padding: '5px 12px' }} onClick={runCheck} disabled={chkBusy}>{chkBusy ? 'Checking…' : 'Check duplicate element numbers'}</button>
          <span style={{ fontSize: 12, color: '#8a979d' }}>Read only. Looks at every element number the site holds; nothing is changed.</span>
        </div>
        {chkRes && chkRes.error && <div style={{ fontSize: 13, color: '#b00020', marginTop: 6 }}>{chkRes.error}</div>}
        {chkRes && !chkRes.error && (
          <div style={{ fontSize: 13, color: '#16262e', marginTop: 8, lineHeight: 1.6 }}>
            <div>Looked at {chkRes.scanned.rows} rows, {chkRes.scanned.elementNumbers} element numbers, {chkRes.scanned.projects} projects, {chkRes.scanned.models} models.</div>
            <div style={{ color: chkRes.sameSchedule.length ? '#b00020' : '#2e7d32' }}>Same number twice in one schedule: {chkRes.sameSchedule.length ? chkRes.sameSchedule.length + ' found' : 'none found'}</div>
            {chkRes.sameSchedule.slice(0, 10).map((x, i) => <div key={i} style={{ fontSize: 12, color: '#45565e' }}>{x.element} in {x.schedule} ({x.project}) x{x.times}</div>)}
            <div style={{ color: chkRes.sameProjectOtherModel.length ? '#b00020' : '#2e7d32' }}>Same number in two models of one project: {chkRes.sameProjectOtherModel.length ? chkRes.sameProjectOtherModel.length + ' found' : 'none found'}</div>
            {chkRes.sameProjectOtherModel.slice(0, 10).map((x, i) => <div key={i} style={{ fontSize: 12, color: '#45565e' }}>{x.element} in {x.project}</div>)}
            <div style={{ color: chkRes.issuesAmbiguous.length ? '#b00020' : '#2e7d32' }}>Issue cards that point to a number used in two models: {chkRes.issuesAmbiguous.length ? chkRes.issuesAmbiguous.length + ' found' : 'none found'}</div>
            <div style={{ color: '#6b675c' }}>Same number in different projects: {chkRes.otherProjects.count ? chkRes.otherProjects.count + ' found (not a problem: the project name is in every ID)' : 'none found'}</div>
            {chkRes.otherProjects.examples.slice(0, 8).map((x, i) => <div key={i} style={{ fontSize: 12, color: '#45565e' }}>{x.element}: {x.projects.join(', ')}</div>)}
            {chkRes.note && <div style={{ fontSize: 12, color: '#8a979d' }}>{chkRes.note}</div>}
          </div>
        )}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#16262e', marginBottom: 4 }}>Pages (their code goes into every button on that page)</div>
      {cat.pages.map((p) => (
        <div key={p.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 13, color: '#45565e' }}>
          <span style={{ flex: 1 }}>{p.name}</span>
          <input style={{ ...field, width: 130, fontFamily: 'ui-monospace, Menlo, monospace' }} value={p.code} onChange={(e) => setCat({ ...cat, pages: cat.pages.map((x) => (x.k === p.k ? { ...x, code: e.target.value } : x)) })} aria-label={'Code of ' + p.name} />
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <button type="button" onClick={save} style={{ ...pill, fontSize: 13, padding: '5px 12px', background: '#16262e', color: '#fff', border: 0 }}>Save list</button>
        {msg && <b style={{ fontSize: 12, color: msg === 'Saved' ? '#2e7d32' : '#b00020' }}>{msg}</b>}
        <span style={{ fontSize: 12, color: '#8a979d' }}>Samples only: no card or button uses these IDs yet.</span>
      </div>
    </div>
  );
}

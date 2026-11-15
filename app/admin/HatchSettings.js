'use client';
import { useEffect, useState } from 'react';
import { hatchColor, cleanHatch, HATCH_DEFAULTS } from '../../lib/hatch';
const inp = { padding: '6px 8px', fontSize: 14, border: '1px solid #cfd8dc', borderRadius: 6, background: '#fff' };
const btn = { padding: '6px 12px', fontSize: 13, fontWeight: 600, border: '1px solid #cfd8dc', borderRadius: 16, background: '#fff', cursor: 'pointer' };
const SAMPLES = ['c04030', '3070c0', '40a050', 'd0a020', '808080'];

// Admin > Settings: how parts without a colour filter look (grey, mixed with their own Revit colour). The preview shows the result.
export default function HatchSettings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => { fetch('/api/hatch', { cache: 'no-store' }).then((r) => r.json()).then((j) => setS(j.settings || HATCH_DEFAULTS)).catch(() => setS(HATCH_DEFAULTS)); }, []);
  const set = (p) => { setS((x) => cleanHatch({ ...x, ...p })); setDirty(true); };
  async function save() {
    setMsg('Saving…');
    const r = await fetch('/api/hatch', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settings: s }) });
    if (r.ok) { setDirty(false); setMsg('Saved. Open the 3D view again to see it.'); } else setMsg('Could not save.');
  }
  if (!s) return null;
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>Parts without a colour</h2>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: '#546e7a' }}>Parts that match no colour filter are drawn grey. “Own colour” mixes in a little of the colour Revit gives the part, so you can still tell them apart without them looking like a finished (solid) colour. Keep it low.</p>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14 }}>Style <select value={s.mode} onChange={(e) => set({ mode: e.target.value })} style={inp}><option value="tint">Grey + own colour</option><option value="grey">Plain grey</option></select></label>
        <label style={{ fontSize: 14 }}>Grey <input type="color" value={'#' + s.grey} onChange={(e) => set({ grey: e.target.value })} style={{ ...inp, padding: 0, width: 40, height: 30 }} /></label>
        <label style={{ fontSize: 14 }}>Own colour {s.strength}% <input type="range" min="0" max="100" value={s.strength} disabled={s.mode === 'grey'} onChange={(e) => set({ strength: +e.target.value })} /></label>
        <button type="button" style={{ ...btn, background: dirty ? '#16262e' : '#fff', color: dirty ? '#fff' : '#16262e' }} onClick={save}>Save</button>
        {msg && <span style={{ fontSize: 13, color: '#455a64' }}>{msg}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#546e7a' }}>Preview (Revit colour → shown):</span>
        {SAMPLES.map((m) => (<span key={m} style={{ display: 'inline-flex', gap: 2 }}><span style={{ width: 22, height: 22, background: '#' + m, borderRadius: 4 }} /><span style={{ width: 22, height: 22, background: '#' + hatchColor(m, s), borderRadius: 4, border: '1px solid #cfd8dc' }} /></span>))}
      </div>
    </div>
  );
}

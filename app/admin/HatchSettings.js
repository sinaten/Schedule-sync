'use client';
import { useEffect, useRef, useState } from 'react';
import { hatchColor, cleanHatch, stripeCss, HATCH_DEFAULTS } from '../../lib/hatch';
const inp = { padding: '6px 8px', fontSize: 14, border: '1px solid #cfd8dc', borderRadius: 6, background: '#fff' };
const SAMPLES = ['c04030', '3070c0', '40a050', 'd0a020', '808080'];

// Admin > Settings: how parts without a colour filter look (grey, mixed with their own Revit colour). The preview shows the result.
export default function HatchSettings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => { fetch('/api/hatch', { cache: 'no-store' }).then((r) => r.json()).then((j) => setS(j.settings || HATCH_DEFAULTS)).catch(() => setS(HATCH_DEFAULTS)); }, []);
  const timer = useRef(null);
  const latest = useRef(null);
  latest.current = s;
  // every change is saved by itself a moment later, so nothing is lost on refresh; the Save button at the bottom saves right away
  const set = (p) => { setS((x) => cleanHatch({ ...x, ...p })); setDirty(true); setMsg('Not saved yet…'); clearTimeout(timer.current); timer.current = setTimeout(() => save(), 800); };
  async function save() {
    clearTimeout(timer.current);
    setMsg('Saving…');
    try {
      const r = await fetch('/api/hatch', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settings: latest.current }) });
      if (r.ok) { setDirty(false); setMsg('Saved ✓ Open the 3D view again to see it.'); } else setMsg('Could not save (' + r.status + ').');
    } catch (e) { setMsg('Could not save (no connection).'); }
  }
  if (!s) return null;
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>Parts without a colour</h2>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: '#546e7a' }}>Parts that match no colour filter are drawn grey. “Own colour” mixes in a little of the colour Revit gives the part, so you can still tell them apart without them looking like a finished (solid) colour. Keep it low. “Hatch lines” draws diagonal lines in the part's own colour on the grey; spacing and thickness are in screen pixels, so they look the same at any zoom.</p>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 14 }}>Style <select value={s.mode} onChange={(e) => set({ mode: e.target.value })} style={inp}><option value="tint">Grey + own colour</option><option value="grey">Plain grey</option><option value="stripe">Grey + hatch lines (own colour)</option></select></label>
        <label style={{ fontSize: 14 }}>Grey <input type="color" value={'#' + s.grey} onChange={(e) => set({ grey: e.target.value })} style={{ ...inp, padding: 0, width: 40, height: 30 }} /></label>
        <label style={{ fontSize: 14 }}>Own colour {s.strength}% <input type="range" min="0" max="100" value={s.strength} disabled={s.mode !== 'tint'} onChange={(e) => set({ strength: +e.target.value })} /></label>
        {s.mode === 'stripe' && <>
          <label style={{ fontSize: 14 }}>Spacing {s.stripe.spacing}px <input type="range" min="4" max="60" value={s.stripe.spacing} onChange={(e) => set({ stripe: { ...s.stripe, spacing: +e.target.value } })} /></label>
          <label style={{ fontSize: 14 }}>Line thickness {s.stripe.width}px <input type="range" min="1" max="20" value={s.stripe.width} onChange={(e) => set({ stripe: { ...s.stripe, width: +e.target.value } })} /></label>
          <label style={{ fontSize: 14 }}>Angle {s.stripe.angle}° <input type="range" min="0" max="180" step="15" value={s.stripe.angle} onChange={(e) => set({ stripe: { ...s.stripe, angle: +e.target.value } })} /></label>
        </>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#546e7a' }}>Preview (Revit colour → shown):</span>
        {SAMPLES.map((m) => (<span key={m} style={{ display: 'inline-flex', gap: 2 }}><span style={{ width: 22, height: 22, background: '#' + m, borderRadius: 4 }} /><span style={{ width: s.mode === 'stripe' ? 44 : 22, height: s.mode === 'stripe' ? 44 : 22, background: s.mode === 'stripe' ? stripeCss(m, s) : '#' + hatchColor(m, s), borderRadius: 4, border: '1px solid #cfd8dc' }} /></span>))}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14 }}>
        <button type="button" onClick={save} style={{ padding: '10px 28px', fontSize: 15, fontWeight: 700, border: 'none', borderRadius: 20, background: dirty ? '#e8590c' : '#16262e', color: '#fff', cursor: 'pointer' }}>Save</button>
        {msg && <span style={{ fontSize: 13, color: '#455a64' }}>{msg}</span>}
      </div>
    </div>
  );
}

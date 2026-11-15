'use client';
import { useEffect, useRef, useState } from 'react';
import { fadeColor, cleanFade, FADE_DEFAULTS } from '../../lib/fade';
const SAMPLES = ['d03a2f', '2f6fd0', 'e8821e', '22c3d8', '3aa04a'];

// Admin > Settings: parts with no colour filter show their Revit colour faded toward white. Changes save by themselves; Save saves right away.
export default function FadeSettings() {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState('');
  const [dirty, setDirty] = useState(false);
  const timer = useRef(null);
  const latest = useRef(null);
  latest.current = s;
  useEffect(() => { fetch('/api/fade', { cache: 'no-store' }).then((r) => r.json()).then((j) => setS(j.settings || FADE_DEFAULTS)).catch(() => setS(FADE_DEFAULTS)); }, []);
  async function save() {
    clearTimeout(timer.current);
    setMsg('Saving…');
    try {
      const r = await fetch('/api/fade', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ settings: latest.current }) });
      if (r.ok) { setDirty(false); setMsg('Saved ✓ Open the 3D view again to see it.'); } else setMsg('Could not save (' + r.status + ').');
    } catch (e) { setMsg('Could not save (no connection).'); }
  }
  const set = (amount) => { setS(cleanFade({ amount })); setDirty(true); setMsg('Not saved yet…'); clearTimeout(timer.current); timer.current = setTimeout(save, 800); };
  if (!s) return null;
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 6px' }}>Parts without a filter</h2>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: '#546e7a' }}>Parts that match no colour filter show their own Revit colour, faded toward white. Parts with a filter always stay solid. 0% = full Revit colour, 90% = almost white.</p>
      <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>Fade amount {s.amount}% <input type="range" min="0" max="90" step="5" value={s.amount} onChange={(e) => set(+e.target.value)} style={{ flex: 1, maxWidth: 260 }} /></label>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: '#546e7a' }}>Preview (Revit → shown):</span>
        {SAMPLES.map((m) => (<span key={m} style={{ display: 'inline-flex', gap: 2 }}><span style={{ width: 22, height: 22, background: '#' + m, borderRadius: 4 }} /><span style={{ width: 22, height: 22, background: '#' + fadeColor(m, s), borderRadius: 4, border: '1px solid #cfd8dc' }} /></span>))}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14 }}>
        <button type="button" onClick={save} style={{ padding: '10px 28px', fontSize: 15, fontWeight: 700, border: 'none', borderRadius: 20, background: dirty ? '#e8590c' : '#16262e', color: '#fff', cursor: 'pointer' }}>Save</button>
        {msg && <span style={{ fontSize: 13, color: '#455a64' }}>{msg}</span>}
      </div>
    </div>
  );
}

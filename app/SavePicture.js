'use client';
import { useState } from 'react';

// "Save as picture": turns the scenario map (aerial view or picture with its pins, arrows and labels) into a PNG that can be sent or kept.
export default function SavePicture({ targetId, name, style }) {
  const [msg, setMsg] = useState('');
  const go = async () => {
    const el = document.getElementById(targetId);
    if (!el) return;
    setMsg('Making the picture…');
    try {
      const { default: html2canvas } = await import('html2canvas');
      const c = await html2canvas(el, { useCORS: true, backgroundColor: '#ffffff', scale: Math.min(2, window.devicePixelRatio || 1.5), ignoreElements: (n) => !!(n.classList && (n.classList.contains('leaflet-control-container') || n.classList.contains('leaflet-popup-pane'))) });
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      if (!blob) throw new Error('empty');
      const file = new File([blob], (String(name || 'scenario').replace(/[^\w.-]+/g, '_') || 'scenario') + '.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name || 'Scenario' }); setMsg(''); return; } catch (e) { if (e && e.name === 'AbortError') { setMsg(''); return; } } }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000); setMsg('Picture saved');
    } catch (e) { setMsg('Could not make the picture. Take a screenshot instead.'); }
  };
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="ph-btn" style={style} onClick={go}>Save as picture</button>
      {msg && <span className="muted" style={{ fontSize: 14 }}>{msg}</span>}
    </span>
  );
}

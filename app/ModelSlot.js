'use client';
import { useEffect, useRef } from 'react';

// A window for the 3D model inside a full-screen card. The model viewer of the page is moved over this window (not copied),
// sent to the element of the issue, and put back when the card closes.
export default function ModelSlot({ element, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const b = document.querySelector('.v3-box');
    const slot = ref.current;
    if (!b || !slot) return undefined;
    const orig = b.getAttribute('style');
    let last = '';
    const put = (force) => {
      const r = slot.getBoundingClientRect();
      const key = [r.left, r.top, r.width, r.height].map((x) => Math.round(x)).join(',');
      if (!force && key === last && b.style.position === 'fixed') return;
      const changed = key !== last;
      last = key;
      const set = (k, v) => b.style.setProperty(k, v, 'important');
      set('position', 'fixed'); set('left', r.left + 'px'); set('top', r.top + 'px'); set('right', 'auto'); set('bottom', 'auto');
      set('width', r.width + 'px'); set('height', r.height + 'px'); set('min-height', '0'); set('z-index', '2450');
      set('visibility', 'visible'); set('pointer-events', 'auto'); set('border-radius', '0');
      if (changed) window.dispatchEvent(new Event('resize'));
    };
    put(true);
    const t = setInterval(() => put(false), 400);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => put(false)) : null;
    if (ro) ro.observe(slot);
    window.addEventListener('resize', put);
    const g = setTimeout(() => { if (/^\d+$/.test(String(element)) && window.__ssGoElement) { try { window.__ssGoElement(element); } catch (e) { /* ignore */ } } }, 500);
    return () => {
      clearInterval(t); clearTimeout(g); if (ro) ro.disconnect(); window.removeEventListener('resize', put);
      if (orig == null) b.removeAttribute('style'); else b.setAttribute('style', orig);
      window.dispatchEvent(new Event('resize'));
    };
  }, [element]);
  return (
    <div ref={ref} style={{ position: 'relative', background: '#e8ebf2', borderTop: '3px solid #5b6b8c', minHeight: 0, minWidth: 0, ...style }}>
      <span style={{ position: 'absolute', left: 8, top: 6, fontSize: 9.5, letterSpacing: 0.4, fontWeight: 700, color: '#5b6b8c' }}>3D MODEL</span>
    </div>
  );
}

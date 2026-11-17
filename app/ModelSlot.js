'use client';
import { useEffect, useRef } from 'react';

// A window for the 3D model inside a full-screen card. The whole model section of the page (views, camera icons, the model) is moved into this window (not copied), without the parameter list,
// sent to the element of the issue, and put back where it was when the card closes.
export default function ModelSlot({ element, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const b = document.querySelector('.v3-wrap');
    const slot = ref.current;
    if (!b || !slot) return undefined;
    const home = b.parentNode, next = b.nextSibling;
    const saved = [];
    const st = (el, props) => { if (!el) return; saved.push([el, el.getAttribute('style')]); Object.keys(props).forEach((k) => el.style.setProperty(k, props[k], 'important')); };
    slot.appendChild(b);
    b.classList.add('in-slot');
    // the section fills the window; its own box takes whatever height is left, so the model fits the window by itself
    const box = b.querySelector('.v3-box');
    st(b, { position: 'absolute', left: '0', top: '0', right: '0', bottom: '0', margin: '0', border: '0', 'border-radius': '0', display: 'flex', 'flex-direction': 'column', overflow: 'hidden' });
    st(b.firstElementChild, { display: 'none' });
    b.querySelectorAll('.v3-sheet').forEach((x) => st(x, { display: 'none' }));
    if (box && box.parentElement && box.parentElement !== b) st(box.parentElement, { flex: '1 1 0', 'min-height': '0', display: 'flex', 'flex-direction': 'column' });
    if (box) st(box, { flex: '1 1 0', height: 'auto', 'min-height': '0' });
    const poke = () => window.dispatchEvent(new Event('resize'));
    const t1 = setTimeout(poke, 60), t2 = setTimeout(poke, 400), t3 = setTimeout(poke, 1200);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(poke) : null;
    if (ro) ro.observe(slot);
    const g = setTimeout(() => { if (/^\d+$/.test(String(element)) && window.__ssGoElement) { try { window.__ssGoElement(element); } catch (e) { /* ignore */ } } }, 700);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(g); if (ro) ro.disconnect();
      b.classList.remove('in-slot');
      saved.reverse().forEach(([el, a]) => { if (a == null) el.removeAttribute('style'); else el.setAttribute('style', a); });
      try { if (next && next.parentNode === home) home.insertBefore(b, next); else home.appendChild(b); } catch (e) { /* ignore */ }
      setTimeout(poke, 60);
    };
  }, [element]);
  return (
    <div ref={ref} style={{ position: 'relative', background: '#e8ebf2', borderTop: '3px solid #5b6b8c', minHeight: 0, minWidth: 0, overflow: 'hidden', ...style }}>
      <span style={{ position: 'absolute', left: 8, top: 6, fontSize: 9.5, letterSpacing: 0.4, fontWeight: 700, color: '#5b6b8c' }}>3D MODEL</span>
    </div>
  );
}

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
    const saved = [], tagged = [];
    const st = (el, props) => { if (!el) return; saved.push([el, el.getAttribute('style')]); Object.keys(props).forEach((k) => el.style.setProperty(k, props[k], 'important')); };
    const tag = (el, c) => { if (el) { el.classList.add(c); tagged.push([el, c]); } };
    slot.appendChild(b);
    b.classList.add('in-slot');
    // everything above the picture (view list, Views / Element tabs, search, New) shares one thin line; the model gets all the height left
    const box = b.querySelector('.v3-box');
    const body = box && box.parentElement !== b ? box.parentElement : box;
    const kids = Array.from(b.children);
    st(b, { position: 'absolute', left: '0', top: '0', right: '0', bottom: '0', margin: '0', border: '0', 'border-radius': '0', overflow: 'hidden' });
    st(kids[0], { display: 'none' });
    kids.slice(1).forEach((k) => {
      if (k === body || (box && k.contains(box))) { tag(k, 'ss-body'); return; }
      if (k.tagName === 'DIV' && !k.className && !(k.compareDocumentPosition(box || k) & 2)) {
        const isTabs = Array.from(k.querySelectorAll('button')).some((x) => /^Element$/.test((x.textContent || '').trim()));
        tag(k, isTabs ? 'ss-h2' : 'ss-h1');
      }
    });
    b.querySelectorAll('.v3-sheet').forEach((x) => st(x, { display: 'none' }));
    const css = document.createElement('style');
    css.textContent = `
      .v3-wrap.in-slot{display:grid!important;grid-template-columns:minmax(0,max-content) minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
      .v3-wrap.in-slot > .ss-h1{grid-row:1;grid-column:1;padding:2px 4px 2px 6px!important}
      .v3-wrap.in-slot > .ss-h1 button{height:28px!important;padding:0 10px!important;font-size:12px!important;border-radius:14px!important;width:auto!important;max-width:44vw;gap:6px!important}
      .v3-wrap.in-slot > .ss-h2{grid-row:1;grid-column:2;display:flex!important;align-items:center;gap:2px;min-width:0;overflow-x:auto;scrollbar-width:none}
      .v3-wrap.in-slot > .ss-h2 > div{padding:2px 4px!important;display:flex!important;gap:4px!important;flex-wrap:nowrap!important;align-items:center;flex:none}
      .v3-wrap.in-slot > .ss-h2 input{height:28px!important;font-size:12px!important;min-width:120px!important;width:100%!important}
      .v3-wrap.in-slot > .ss-h2 > div > span{flex:1 1 130px!important;min-width:130px!important;max-width:none!important}
      .v3-wrap.in-slot > .ss-h2 button{height:28px!important;font-size:12px!important;padding:0 10px!important;white-space:nowrap}
      .v3-wrap.in-slot > .ss-body{grid-row:2;grid-column:1/-1;min-height:0!important;display:flex!important;flex-direction:column;position:relative}
      .v3-wrap.in-slot .v3-box{flex:1 1 0!important;height:auto!important;min-height:0!important}
    `;
    document.head.appendChild(css);
    const poke = () => window.dispatchEvent(new Event('resize'));
    const t1 = setTimeout(poke, 60), t2 = setTimeout(poke, 400), t3 = setTimeout(poke, 1200);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(poke) : null;
    if (ro) ro.observe(slot);
    const g = setTimeout(() => { if (/^\d+$/.test(String(element)) && window.__ssGoElement) { try { window.__ssGoElement(element); } catch (e) { /* ignore */ } } }, 700);
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(g); if (ro) ro.disconnect();
      b.classList.remove('in-slot'); tagged.forEach(([el, c]) => el.classList.remove(c)); if (css.parentNode) css.parentNode.removeChild(css);
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

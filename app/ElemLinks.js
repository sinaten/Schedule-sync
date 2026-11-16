'use client';
import { useEffect, useState } from 'react';

// Numbers in a text that are exactly the Revit number of a part of the open model become blue links: a click sends the camera to that part.
// A number that is not a part of the model (a phone number, a time) stays plain text.
export function useModelIds() {
  const [, setT] = useState(0);
  useEffect(() => {
    const f = () => setT((x) => x + 1);
    window.addEventListener('ss-byid', f);
    return () => window.removeEventListener('ss-byid', f);
  }, []);
}
export function isPart(n) {
  const by = typeof window !== 'undefined' ? window.__ssById : null;
  return !!(by && by[parseInt(n, 10)]);
}
export function goPart(n) {
  try { const b = document.querySelector('.v3-box'); if (b) b.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* ignore */ }
  const r = window.__ssGoElement ? window.__ssGoElement(n) : null;
  if (r && !r.ok) window.dispatchEvent(new CustomEvent('ss-elem-msg', { detail: r.msg }));
}
export function linkNums(t, key) {
  const s = String(t == null ? '' : t);
  const out = []; let last = 0, m, k = 0;
  const re = /(?<![\w.])\d{5,9}(?![\w.])/g;
  while ((m = re.exec(s))) {
    if (!isPart(m[0])) continue;
    if (m.index > last) out.push(<span key={key + 's' + k++}>{s.slice(last, m.index)}</span>);
    const n = m[0];
    out.push(<button key={key + 'n' + k++} type="button" title={'Show element ' + n + ' in the model'} onClick={(e) => { e.stopPropagation(); goPart(n); }} style={{ display: 'inline', border: 0, background: 'none', padding: 0, margin: 0, font: 'inherit', color: '#1a6fd4', textDecoration: 'underline', cursor: 'pointer' }}>{n}</button>);
    last = m.index + n.length;
  }
  if (!out.length) return s;
  if (last < s.length) out.push(<span key={key + 's' + k++}>{s.slice(last)}</span>);
  return out;
}

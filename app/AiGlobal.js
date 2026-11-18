'use client';
import { useEffect } from 'react';
import { normalizeAi, aiParts } from '../lib/aitext';

// The "Sina AI" rule on every page.
// Admins and editors: typing (ai. in any text box turns it into (AI. and the box shows the link colour.
// Everyone else (viewers, public share pages): the (AI. ...) notes are hidden wherever text is shown.
const HAS = /\(\s*ai\s*[.\-–:]/i;
export default function AiGlobal({ edit }) {
  useEffect(() => {
    if (!document.getElementById('ai-global-css')) {
      const st = document.createElement('style'); st.id = 'ai-global-css';
      st.textContent = '.has-ai{color:var(--acc,#0a7c86)!important;text-decoration:underline}';
      document.head.appendChild(st);
    }
    if (edit) {
      const fieldOk = (el) => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && ['text', 'search', ''].includes((el.getAttribute('type') || '').toLowerCase())));
      const mark = (el) => el.classList.toggle('has-ai', /\(AI[.\-–:]/.test(el.value));
      const onInput = (e) => {
        const el = e.target;
        if (!fieldOk(el) || el.closest('[data-ai-managed]')) return;
        if (HAS.test(el.value)) {
          const n = normalizeAi(el.value);
          if (n !== el.value) {
            const pos = el.selectionStart;
            const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, n);
            try { el.setSelectionRange(pos, pos); } catch (x) { /* some input types have no selection */ }
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        mark(el);
      };
      const onFocus = (e) => { if (fieldOk(e.target) && !e.target.closest('[data-ai-managed]')) mark(e.target); };
      document.addEventListener('input', onInput, true);
      document.addEventListener('focusin', onFocus, true);
      return () => { document.removeEventListener('input', onInput, true); document.removeEventListener('focusin', onFocus, true); };
    }
    // everyone else: hide the notes in shown text
    const skip = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT']);
    const scrub = (root) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const list = []; let n;
      while ((n = w.nextNode())) { if (n.nodeValue && HAS.test(n.nodeValue) && n.parentNode && !skip.has(n.parentNode.nodeName)) list.push(n); }
      list.forEach((t) => { const v = aiParts(t.nodeValue).filter((p) => !p.ai).map((p) => p.text).join(''); if (v !== t.nodeValue) t.nodeValue = v; });
    };
    let busy = false;
    const run = () => { if (busy) return; busy = true; try { scrub(document.body); } finally { busy = false; } };
    run();
    const mo = new MutationObserver(() => { mo.disconnect(); run(); mo.observe(document.body, { childList: true, subtree: true, characterData: true }); });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [edit]);
  return null;
}

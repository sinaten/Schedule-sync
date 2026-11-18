'use client';
import { useRef, useLayoutEffect } from 'react';
import { normalizeAi, aiParts } from '../../lib/aitext';

// A text box where (AI. ...) notes turn into the link colour as you type. Those notes are for the Sina AI only; people on the share pages never see them.
const base = { font: 'inherit', fontSize: 16, lineHeight: 1.4, padding: '8px 10px', border: '1px solid var(--line)', borderRadius: 6, boxSizing: 'border-box', width: '100%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 };
export default function AiText({ value, onChange, rows = 4, placeholder }) {
  const ta = useRef(null), bk = useRef(null), caret = useRef(null);
  const v = String(value || '');
  useLayoutEffect(() => {
    const t = ta.current; if (!t) return;
    t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight, rows * 22 + 18) + 'px';
    if (bk.current) bk.current.style.height = t.style.height;
    if (caret.current !== null && document.activeElement === t) { t.setSelectionRange(caret.current, caret.current); }
    caret.current = null;
  });
  const parts = aiParts(v);
  return (
    <div data-ai-managed="1" style={{ position: 'relative' }}>
      <div ref={bk} aria-hidden="true" style={{ ...base, position: 'absolute', inset: 0, background: '#fff', color: 'var(--ink)', pointerEvents: 'none', overflow: 'hidden' }}>
        {parts.map((p, i) => <span key={i} style={p.ai ? { color: 'var(--acc)', fontWeight: 600, textDecoration: 'underline' } : null}>{p.text}</span>)}
        {'​'}
      </div>
      <textarea ref={ta} rows={rows} placeholder={placeholder} value={v}
        onChange={(e) => { const raw = e.target.value, n = normalizeAi(raw); caret.current = e.target.selectionStart; onChange(n); }}
        style={{ ...base, position: 'relative', display: 'block', background: 'transparent', color: 'transparent', caretColor: 'var(--ink)', resize: 'none', overflow: 'hidden' }} />
    </div>
  );
}

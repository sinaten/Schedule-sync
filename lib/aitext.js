// "Sina AI" notes: in any text box, a part written as (AI. like this) or (AI - like this) is for the AI only.
// People who open the share pages never see it; it stays in the stored text so the AI can read it, add to it, fix or remove it.
const OPEN = /\(\s*ai\s*([.\-–:])/gi;

// typing (ai. makes it (AI.
export function normalizeAi(t) { return String(t == null ? '' : t).replace(OPEN, (m, d) => '(AI' + d); }

// [{ ai: bool, text }] pieces in order; a note runs to its matching ")" (inner brackets allowed) or to the end of the text while it is still open
export function aiParts(t) {
  t = normalizeAi(t);
  const out = []; let i = 0, buf = '';
  const re = /\(AI[.\-–:]/g;
  while (i < t.length) {
    re.lastIndex = i;
    const m = re.exec(t);
    if (!m) { buf += t.slice(i); break; }
    buf += t.slice(i, m.index);
    if (buf) out.push({ ai: false, text: buf }); buf = '';
    let d = 0, j = m.index;
    for (; j < t.length; j++) { if (t[j] === '(') d++; else if (t[j] === ')') { d--; if (d === 0) { j++; break; } } }
    out.push({ ai: true, text: t.slice(m.index, j) });
    i = j;
  }
  if (buf) out.push({ ai: false, text: buf });
  return out;
}
// what people see: everything except the AI notes
export function stripAi(t) {
  return aiParts(t).filter((p) => !p.ai).map((p) => p.text).join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}
// the notes alone (text inside the brackets, without the "(AI." and ")")
export function aiNotes(t) {
  return aiParts(t).filter((p) => p.ai).map((p) => p.text.replace(/^\(AI[.\-–:]\s*/, '').replace(/\)$/, '').trim());
}

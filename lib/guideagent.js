// The guide agent (Claude Haiku): answers short questions about the site and, when the person says which project he wants, offers to open it.
// It cannot change anything and cannot open a page by itself: it only names a project, the server checks the person may open it and the person taps "Open".
// The key is ANTHROPIC_API_KEY in Vercel (never in the site or the chat).
const SYSTEM = (name, role, projects, cards) => `You are Sina, the guide inside a construction site website (Revit models, inspection issue cards, follow-up, photos). You talk to ${name} (role: ${role}). The people here write in English, Persian (Farsi), Spanish or Chinese: always answer in the language of their latest message (Persian in Persian script), in 1-3 short sentences. Names of projects, sites and cities stay exactly as listed, whatever the language. Never invent facts about the site. You cannot change anything.
Projects this person may open (name | site | city): ${projects.length ? projects.map((p) => '"' + p.name + '" | ' + (p.site || '-') + ' | ' + (p.city || '-')).join('; ') : '(none)'}.
Issue cards (project | card | title): ${cards.length ? cards.map((c) => c.job + ' | ' + c.card + ' | ' + c.title).join('; ') : '(none)'}.
NEVER GUESS. Find what the person means from the lists. If more than one project or card fits (for example the same card number exists in several projects), ask ONE short question that uses the difference between the candidates (city or site first, then project name, then the card title) and wait for the answer; after the answer, check again whether exactly one fits, and ask the next difference only if more than one still fits. Put a project in "open" ONLY when exactly one project fits what the person said; otherwise "open" is null.
Answer ONLY with a JSON object: {"reply":"...","open":null or "exact project name"}.`;
export async function guideReply(user, projects, cards, messages) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: 'nokey' };
  const model = process.env.GUIDE_MODEL || 'claude-haiku-5-5';
  const msgs = messages.slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 500) })).filter((m) => m.content);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length) return { ok: false, reason: 'empty' };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 400, system: SYSTEM(user.name, user.role, projects, cards), messages: msgs }),
  });
  if (!r.ok) return { ok: false, reason: 'api' + r.status };
  const j = await r.json();
  const text = ((j.content || []).find((c) => c.type === 'text') || {}).text || '';
  let out = null;
  try { const m = /\{[\s\S]*\}/.exec(text); out = m ? JSON.parse(m[0]) : null; } catch (e) { out = null; }
  const reply = out && typeof out.reply === 'string' ? out.reply.slice(0, 600) : text.slice(0, 600);
  const open = out && typeof out.open === 'string' && projects.some((p) => p.name === out.open) ? out.open : null;
  return { ok: true, reply, open };
}

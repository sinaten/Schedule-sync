// The guide agent (Claude Haiku): answers short questions about the site and, when the person says which project he wants, offers to open it.
// It cannot change anything and cannot open a page by itself: it only names a project, the server checks the person may open it and the person taps "Open".
import { GUIDE_TEXT } from './siteguide';
// The key is ANTHROPIC_API_KEY in Vercel (never in the site or the chat).
const SYSTEM = (name, role, projects, cards) => `You are Sina, the guide inside a construction site website (Revit models, inspection issue cards, follow-up, photos). You talk to ${name} (role: ${role}). The people here write in English, Persian (Farsi), Spanish or Chinese: always answer in the language of their latest message (Persian in Persian script), in 1-3 short sentences. Names of projects, sites and cities stay exactly as listed, whatever the language. Never invent facts about the site. You cannot change anything.
Projects this person may open (name | site | city): ${projects.length ? projects.map((p) => '"' + p.name + '" | ' + (p.site || '-') + ' | ' + (p.city || '-')).join('; ') : '(none)'}.
Issue cards (project | card | title): ${cards.length ? cards.map((c) => c.job + ' | ' + c.card + ' | ' + c.title).join('; ') : '(none)'}.
BE BRIEF: "reply" is ONE short sentence, at most 12 words, no filler, no greetings. When the person asks to go to a project and one project clearly fits (including the one assigned to them or at their location), open it at once with no question. If several fit, do not ask a long question: put them in "choices" right away with a very short reply like "Which one?".
NEVER GUESS. Find what the person means from the lists. If more than one project or card fits (for example the same card number exists in several projects), ask ONE short question that uses the difference between the candidates (city or site first, then project name, then the card title) and wait for the answer; after the answer, check again whether exactly one fits, and ask the next difference only if more than one still fits. Put a project in "open" ONLY when exactly one project fits what the person said; otherwise "open" is null.
${GUIDE_TEXT}
When you must ask which one they mean and 2 to 6 candidates fit, ALSO put the candidates in "choices" as [{"label":"exact project name, or card number and title","note":"what tells it apart, e.g. site and city"}] and keep "reply" to one short sentence; otherwise "choices" is [].
ISSUE FILLING: if the person wants to report or open an issue and the page is a project page (see PAGE below), set "issue":{"text":"the issue described clearly in their language, from what they said, nothing invented","priority":"critical" or "noncritical"} and reply in one short sentence that it is filled in and they should check it and press Save. You never save. If they are not on a project page, tell them to open the project first. Otherwise "issue" is null.
Answer ONLY with a JSON object: {"reply":"...","open":null or "exact project name","choices":[],"issue":null}.`;
const LANGNAME = { en: 'English', fa: 'Persian (Farsi, Persian script)', es: 'Spanish', zh: 'Chinese' };
export async function guideReply(user, projects, cards, messages, lang, onJob, where) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: 'nokey' };
  const model = process.env.GUIDE_MODEL || 'claude-haiku-5-5';
  const msgs = messages.slice(-8).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 500) })).filter((m) => m.content);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  if (!msgs.length) return { ok: false, reason: 'empty' };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 350, system: SYSTEM(user.name, user.role, projects, cards) + '\nPAGE: ' + (onJob ? 'the person is on a project page' : 'the person is NOT on a project page') + (where ? ' (address ' + (where.path ? where.path : '?') + ', tab: ' + (where.tab || 'none') + ')' : '') + (LANGNAME[lang] ? '\nLANGUAGE LOCK: the person chose ' + LANGNAME[lang] + ' with the language button. Understand their message as ' + LANGNAME[lang] + ' (the text may come from speech recognition and contain mistakes) and ALWAYS answer in ' + LANGNAME[lang] + ', even if the words look like another language.' : ''), messages: msgs }),
  });
  if (!r.ok) return { ok: false, reason: 'api' + r.status };
  const j = await r.json();
  const text = ((j.content || []).find((c) => c.type === 'text') || {}).text || '';
  let out = null;
  try { const m = /\{[\s\S]*\}/.exec(text); out = m ? JSON.parse(m[0]) : null; } catch (e) { out = null; }
  const reply = out && typeof out.reply === 'string' ? out.reply.slice(0, 600) : text.slice(0, 600);
  const open = out && typeof out.open === 'string' && projects.some((p) => p.name === out.open) ? out.open : null;
  const choices = out && Array.isArray(out.choices) ? out.choices.slice(0, 6).map((c) => ({ label: String((c && c.label) || '').slice(0, 80), note: String((c && c.note) || '').slice(0, 100) })).filter((c) => c.label) : [];
  const iss = out && out.issue && typeof out.issue === 'object' && typeof out.issue.text === 'string' && out.issue.text.trim() ? { text: out.issue.text.trim().slice(0, 1500), priority: out.issue.priority === 'critical' ? 'critical' : 'noncritical' } : null;
  return { ok: true, reply, open, choices, issue: onJob ? iss : null };
}

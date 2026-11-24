// The tracking agent: a cheap Claude model that looks a tracking number up on the web (any carrier: UPS, FedEx, USPS, DHL, Amazon, OnTrac, ...) and gives back ONE short status.
// It only reads. It never guesses: when no page shows the status it says "not found". The key is ANTHROPIC_API_KEY in Vercel (never written in the site or the chat).
const VALID = ['created', 'transit', 'out', 'delivered', 'delayed'];
const PROMPT = (t, c) => `Find the current delivery status of the package with tracking number ${t}${c ? ` (it looks like a ${c} number, but check)` : ''}.
Use web search and web fetch. Look at the carrier's own tracking page first; if it does not show the status (many carrier pages need JavaScript), look at other tracking pages that show it. Any carrier is fine.
Rules: only report what a page really shows. Do not guess and do not make anything up. If you cannot see a real status for this exact number, answer found=false.
Answer with ONE JSON object and nothing else:
{"found": true|false, "carrier": "UPS|FedEx|USPS|DHL|Amazon|OnTrac|Other|", "status": "created|transit|out|delivered|delayed", "eta": "short date like Nov 25 or null", "last_scan": "place and time of the last scan, short, or null"}
status: created = label made, not picked up; transit = on its way; out = out for delivery; delivered = delivered; delayed = delayed or exception.`;

export async function checkTracking(tracking, carrier) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, reason: 'nokey' };
  const model = process.env.TRACK_MODEL || 'claude-haiku-5-5';
  let messages = [{ role: 'user', content: PROMPT(tracking, carrier) }], text = '';
  for (let i = 0; i < 3; i++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 700, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }, { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 3 }] }),
    });
    if (!r.ok) return { ok: false, reason: r.status === 401 ? 'badkey' : r.status === 402 || r.status === 429 ? 'limit' : 'error' };
    const j = await r.json();
    const blocks = Array.isArray(j.content) ? j.content : [];
    text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    if (j.stop_reason === 'pause_turn') { messages = [...messages, { role: 'assistant', content: blocks }]; continue; }
    break;
  }
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: true, found: false };
  let o; try { o = JSON.parse(m[0]); } catch (e) { return { ok: true, found: false }; }
  if (!o || o.found !== true || !VALID.includes(o.status)) return { ok: true, found: false };
  const s = (v, n) => (v == null || v === 'null' ? null : String(v).slice(0, n));
  return { ok: true, found: true, status: o.status, carrier: s(o.carrier, 20), eta: s(o.eta, 30), last_scan: s(o.last_scan, 120) };
}

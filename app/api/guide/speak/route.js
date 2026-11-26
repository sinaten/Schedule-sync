import { db } from '../../../../lib/db';
import { currentUser } from '../../../../lib/user';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
// Text to speech on the server (the phone only plays the sound). Needs OPENAI_API_KEY in Vercel; Sina must be on. 60 answers per hour per person.
const hits = new Map();
export async function POST(req) {
  const u = await currentUser();
  if (!u) return Response.json({ error: 'Sign in' }, { status: 401 });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Response.json({ error: 'novoicekey' }, { status: 501 });
  const sql = await db();
  const [r] = await sql`select value from settings where key = 'guideagent'`;
  if (!(r && r.value && r.value.on === true)) return Response.json({ error: 'off' }, { status: 409 });
  const now = Date.now();
  const h = (hits.get(u.name) || []).filter((t) => now - t < 3600000);
  if (h.length >= 60) return Response.json({ error: 'Too many answers this hour.' }, { status: 429 });
  h.push(now); hits.set(u.name, h);
  const b = await req.json().catch(() => ({}));
  const text = String(b.text || '').slice(0, 600);
  if (!text.trim()) return Response.json({ error: 'No text' }, { status: 400 });
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.VOICE_TTS_MODEL || 'gpt-4o-mini-tts', voice: process.env.VOICE_NAME || 'alloy', input: text, response_format: 'mp3' }),
  });
  if (!res.ok) return Response.json({ error: 'Could not speak (' + res.status + ')' }, { status: 502 });
  return new Response(res.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' } });
}

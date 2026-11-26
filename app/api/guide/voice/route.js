import { db } from '../../../../lib/db';
import { currentUser } from '../../../../lib/user';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
// Speech to text on the server (the phone only records). Needs OPENAI_API_KEY in Vercel; Sina must be on. 60 clips per hour per person.
const hits = new Map();
const CODES = { en: 'en', fa: 'fa', es: 'es', zh: 'zh' };
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
  if (h.length >= 60) return Response.json({ error: 'Too many voice clips this hour.' }, { status: 429 });
  h.push(now); hits.set(u.name, h);
  let fd;
  try { fd = await req.formData(); } catch (e) { return Response.json({ error: 'Bad audio' }, { status: 400 }); }
  const file = fd.get('audio');
  if (!file || typeof file === 'string' || !file.size) return Response.json({ error: 'No audio' }, { status: 400 });
  if (file.size > 3500000) return Response.json({ error: 'Clip too long' }, { status: 413 });
  const out = new FormData();
  out.append('file', file, file.name || 'clip.m4a');
  out.append('model', process.env.VOICE_STT_MODEL || 'gpt-4o-transcribe');
  const l = CODES[String(fd.get('lang') || '')];
  if (l) out.append('language', l);
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: 'Bearer ' + key }, body: out });
  if (!res.ok) return Response.json({ error: 'Could not read the voice (' + res.status + ')' }, { status: 502 });
  const j = await res.json().catch(() => ({}));
  return Response.json({ text: String(j.text || '').slice(0, 500) });
}

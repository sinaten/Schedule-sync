import { db } from '../../../lib/db';
import { currentUser, canJob, isAdmin } from '../../../lib/user';
import { guideReply } from '../../../lib/guideagent';
import { issuesDb } from '../../../lib/issues';
export const dynamic = 'force-dynamic';

// The guide is switched off until an admin turns it on (so no tokens are used by accident). Each person: at most 30 questions an hour.
async function isOn(sql) { const [r] = await sql`select value from settings where key = 'guideagent'`; return !!(r && r.value && r.value.on === true); }
const hits = new Map();
export async function GET() {
  const u = await currentUser();
  if (!u) return Response.json({ error: 'Sign in' }, { status: 401 });
  const sql = await db();
  return Response.json({ on: await isOn(sql), admin: isAdmin(u), name: u.name || '', voice: !!process.env.OPENAI_API_KEY });
}
export async function POST(req) {
  const u = await currentUser();
  if (!u) return Response.json({ error: 'Sign in' }, { status: 401 });
  const sql = await db();
  const b = await req.json().catch(() => ({}));
  if (typeof b.toggle === 'boolean') {
    if (!isAdmin(u)) return Response.json({ error: 'Admins only' }, { status: 403 });
    await sql`insert into settings(key, value) values('guideagent', ${JSON.stringify({ on: b.toggle })}::jsonb) on conflict (key) do update set value = excluded.value`;
    return Response.json({ ok: true, on: b.toggle });
  }
  if (!(await isOn(sql))) return Response.json({ error: 'off' }, { status: 409 });
  const now = Date.now();
  const h = (hits.get(u.name) || []).filter((t) => now - t < 3600000);
  if (h.length >= 30) return Response.json({ error: 'Too many questions this hour. Try again later.' }, { status: 429 });
  h.push(now); hits.set(u.name, h);
  const rows = await sql`select distinct job from schedules where coalesce(job, '') <> '' order by 1`;
  const names = rows.map((r) => r.job).filter((j) => canJob(u, j));
  // what tells projects apart: site name and city (project settings -> site settings)
  const meta = await sql`select substr(key, 10) as job, value from settings where key like 'projmeta:%'`;
  const sites = await sql`select substr(key, 6) as id, value from settings where key like 'site:%'`;
  const siteOf = new Map(meta.map((m) => [m.job, (m.value && m.value.siteId) || '']));
  const siteBy = new Map(sites.map((x) => [x.id, x.value || {}]));
  const projects = names.map((n) => { const sv = siteBy.get(siteOf.get(n) || '') || {}; return { name: n, site: sv.name || '', city: [sv.city, sv.country].filter(Boolean).join(', ') }; });
  let cards = [];
  try {
    const isql = await issuesDb();
    const ir = await isql`select job, no, description from issues order by updated_at desc limit 400`;
    cards = ir.filter((c) => names.includes(c.job)).slice(0, 250).map((c) => ({ job: c.job, card: 'ISS-' + String(c.no || 0).padStart(4, '0'), title: String(c.description || '').split('\n')[0].slice(0, 60) }));
  } catch (e) { cards = []; }
  const r = await guideReply(u, projects, cards, Array.isArray(b.messages) ? b.messages : []);
  if (!r.ok) return Response.json({ error: r.reason === 'nokey' ? 'Sina has no key yet.' : 'Sina could not answer now.' }, { status: 502 });
  return Response.json({ reply: r.reply, open: r.open });
}

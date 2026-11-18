import { randomUUID } from 'crypto';
import { db } from '../../../../lib/db';
import { currentUser, isAdmin } from '../../../../lib/user';
import { cleanScenario } from '../../../../lib/scenario';
export const dynamic = 'force-dynamic';
const no = () => Response.json({ error: 'Admins only' }, { status: 403 });
const okTok = (t) => /^[a-f0-9]{32}$/.test(String(t || ''));

// Admins only. GET ?site=id = the scenarios of a site (name + link token); GET ?token=... = one scenario in full;
// PUT { site, token?, scenario } = save (a new one gets its secret token); DELETE ?token=... = remove it.
export async function GET(req) {
  if (!isAdmin(await currentUser())) return no();
  const q = new URL(req.url).searchParams, sql = await db();
  if (q.get('token')) {
    if (!okTok(q.get('token'))) return Response.json({ error: 'No scenario' }, { status: 404 });
    const [r] = await sql`select value from settings where key = ${'scn:' + q.get('token')}`;
    return r ? Response.json({ scenario: r.value, site: r.value.site }) : Response.json({ error: 'No scenario' }, { status: 404 });
  }
  const site = String(q.get('site') || '');
  const rows = await sql`select key, value from settings where starts_with(key, 'scn:') and value->>'site' = ${site}`;
  const list = rows.map((r) => ({ token: r.key.slice(4), name: r.value.name || 'Scenario', at: r.value.at || 0 })).sort((a, b) => b.at - a.at);
  return Response.json({ scenarios: list });
}
export async function PUT(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const site = String(b.site || '');
  if (!/^[\w~-]{1,80}$/.test(site)) return Response.json({ error: 'No site' }, { status: 400 });
  const sql = await db();
  let token = String(b.token || '');
  if (token) { if (!okTok(token)) return Response.json({ error: 'Bad link' }, { status: 400 }); const [r] = await sql`select value from settings where key = ${'scn:' + token}`; if (!r || r.value.site !== site) return Response.json({ error: 'No scenario' }, { status: 404 }); }
  else token = randomUUID().replace(/-/g, '');
  const value = { ...cleanScenario(b.scenario), site, at: Date.now() };
  await sql`insert into settings(key, value) values(${'scn:' + token}, ${JSON.stringify(value)}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true, token });
}
export async function DELETE(req) {
  if (!isAdmin(await currentUser())) return no();
  const t = new URL(req.url).searchParams.get('token');
  if (!okTok(t)) return Response.json({ error: 'No scenario' }, { status: 404 });
  const sql = await db();
  await sql`delete from settings where key = ${'scn:' + t}`;
  return Response.json({ ok: true });
}

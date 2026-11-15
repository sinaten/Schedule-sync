import { currentUser } from '../../../../lib/user';
import { getAccess, canSee } from '../../../../lib/access';
import { db } from '../../../../lib/db';
import { visitsDb } from '../../../../lib/visits';
import { getLoc } from '../../../../lib/locrules';
import { activityDb } from '../../../../lib/activity';
import { histDb } from '../../../../lib/history';
import { issuesDb } from '../../../../lib/issues';
export const dynamic = 'force-dynamic';

// Admin (and whoever the admin allows in Settings > Access): per person, how many of their photos / videos were taken near the QR location (green / orange / red) or could not be checked.
export async function GET(req) {
  if (!canSee(await currentUser(), 'analysis', await getAccess())) return Response.json({ error: 'Not allowed' }, { status: 403 });
  // ?log=<username> (or ?log=* for everyone): the full counter history, newest first (day, time Columbus, who, job, what)
  const lg = new URL(req.url).searchParams.get('log');
  if (lg) {
    const s = await activityDb();
    const rows = lg === '*'
      ? await s`select id, to_char(at at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI:SS') as t, who, job, kind from activity order by at desc limit 1000`
      : await s`select id, to_char(at at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI:SS') as t, who, job, kind from activity where who = ${lg} order by at desc limit 1000`;
    return Response.json({ log: rows });
  }
  const lr = await getLoc();
  const sql = await visitsDb();
  const users = await sql`select username, role from users`;
  const rows = await sql`select username,
      count(*) filter (where d is null)::int as u,
      count(*) filter (where d <= ${lr.green})::int as g,
      count(*) filter (where d > ${lr.green} and d <= ${lr.orange})::int as o,
      count(*) filter (where d > ${lr.orange})::int as r
    from (select v.username, case when s.lat is not null and s.lng is not null and v.lat is not null and v.lng is not null then 2 * 6371000 * asin(sqrt(least(1, power(sin(radians(v.lat::float8 - s.lat::float8) / 2), 2) + cos(radians(s.lat::float8)) * cos(radians(v.lat::float8)) * power(sin(radians(v.lng::float8 - s.lng::float8) / 2), 2)))) end as d
      from media m join visits v on v.id = m.visit_id left join sections s on s.id = v.section_id where m.kind <> 'scan') t
    where username is not null group by username`;
  const role = {};
  for (const u of users) role[u.username] = u.role;
  const out = rows.map((r) => ({ username: r.username, role: role[r.username] || (r.username === process.env.ADMIN_USER ? 'admin' : 'user'), g: r.g, o: r.o, r: r.r, u: r.u }));
  // people with no photos yet still get a row
  for (const u of users) if (!out.find((x) => x.username === u.username)) out.push({ username: u.username, role: u.role, g: 0, o: 0, r: 0, u: 0 });
  out.sort((a, b) => a.username.localeCompare(b.username));
  // usage: who caused change-counter bumps / token-costing model conversions, and what each person did (times in Columbus, Ohio time)
  const TZ = 'America/New_York';
  const safe = async (f, fb) => { try { return await f(); } catch (e) { return fb; } };
  const asql = await safe(() => activityDb(), null);
  const isql = await safe(() => issuesDb(), null);
  const hsql = await safe(() => histDb(), null);
  const days = asql ? await safe(() => asql`select to_char(at at time zone ${TZ}, 'YYYY-MM-DD') as day, kind, count(*)::int as n from activity where at > now() - interval '14 days' group by 1, 2 order by 1`, []) : [];
  const hours = asql ? await safe(() => asql`select extract(hour from at at time zone ${TZ})::int as h, kind, count(*)::int as n from activity where at > now() - interval '14 days' group by 1, 2`, []) : [];
  const act = asql ? await safe(() => asql`select who, count(*) filter (where kind = 'model')::int as models, count(*) filter (where kind = 'change')::int as changes, count(*) filter (where kind = 'view')::int as views, max(at) as last from activity group by who`, []) : [];
  const notes = isql ? await safe(() => isql`select author, count(*) filter (where pathname is null and coalesce(body, '') <> '')::int as n, max(created_at) as last from issue_items group by author`, []) : [];
  const hist = hsql ? await safe(() => hsql`select username, coalesce(sum(jsonb_array_length(changes)), 0)::int as n, max(taken_at) as last from history group by username`, []) : [];
  const hrs = await safe(() => (async () => {
    const parts = [];
    if (asql) parts.push(asql`select who as u, to_char(at at time zone ${TZ}, 'YYYY-MM-DD HH24') as k from activity`);
    if (isql) parts.push(isql`select author as u, to_char(created_at at time zone ${TZ}, 'YYYY-MM-DD HH24') as k from issue_items`);
    if (hsql) parts.push(hsql`select username as u, to_char(taken_at at time zone ${TZ}, 'YYYY-MM-DD HH24') as k from history`);
    return (await Promise.all(parts)).flat();
  })(), []);
  const per = {};
  const P = (n) => (per[n] ||= { username: n, notes: 0, changes: 0, models: 0, views: 0, hours: new Set(), last: null });
  const L = (p, t) => { if (t && (!p.last || new Date(t) > new Date(p.last))) p.last = t; };
  for (const r of act) if (r.who) { const p = P(r.who); p.models = r.models; p.views = r.views; p.changes += r.changes; L(p, r.last); }
  for (const r of notes) if (r.author) { const p = P(r.author); p.notes = r.n; L(p, r.last); }
  for (const r of hist) if (r.username) { const p = P(r.username); p.changes += r.n; L(p, r.last); }
  for (const r of hrs) if (r.u) P(r.u).hours.add(r.k);
  const people = Object.values(per).map((p) => ({ username: p.username, notes: p.notes, changes: p.changes, models: p.models, views: p.views, hours: p.hours.size, last: p.last })).sort((a, b) => new Date(b.last || 0) - new Date(a.last || 0));
  return Response.json({ rows: out, green: lr.green, orange: lr.orange, usage: { days, hours, people } });
}

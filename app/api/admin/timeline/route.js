import { db } from '../../../../lib/db';
import { currentUser, isAdmin } from '../../../../lib/user';
import { histDb } from '../../../../lib/history';
import { getColorRules } from '../../../../lib/colorrules';
export const dynamic = 'force-dynamic';

// Admin: everything the Timeline needs for one job.
//   events  every saved change of the job, oldest first: { t, user, element, param, from, to, lat, lng }
//   rules   the colour rules of the job
//   rows    the current values of every part: [{ element_id, vals }]
//   users   the people who made changes
export async function GET(req) {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const job = new URL(req.url).searchParams.get('job') || '';
  if (!job) return Response.json({ error: 'job required' }, { status: 400 });
  const sql = await db();
  const h = await histDb();
  const recs = await h`select username, taken_at, lat, lng, changes from history where job = ${job} order by taken_at asc limit 5000`;
  const events = [];
  for (const r of recs) {
    for (const c of Array.isArray(r.changes) ? r.changes : []) {
      const t = c.at ? new Date(c.at).getTime() : new Date(r.taken_at).getTime();
      if (!Number.isFinite(t)) continue;
      events.push({ t, user: r.username, element: String(c.element), param: c.param, from: c.from === true, to: c.to === true, lat: r.lat, lng: r.lng });
    }
  }
  events.sort((a, b) => a.t - b.t);
  const rules = await getColorRules(sql, job);
  const rows = await sql`select r.element_id, r.vals from rows r join schedules s on s.id = r.schedule_id where s.job = ${job}`;
  const by = new Map();
  for (const r of rows) { const e = by.get(r.element_id); if (e) Object.assign(e.vals, r.vals || {}); else by.set(r.element_id, { element_id: r.element_id, vals: { ...(r.vals || {}) } }); }
  return Response.json({ events, rules, rows: [...by.values()], users: [...new Set(events.map((e) => e.user))].sort() });
}

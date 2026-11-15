import { db } from '../../../lib/db';
import { currentUser, canJob, isAdmin } from '../../../lib/user';
import { getColorRules, putColorRules, fromLook, computeColors } from '../../../lib/colorrules';
import { bumpRev } from '../../../lib/rev';
export const dynamic = 'force-dynamic';

async function lookOf(sql, job) { const [r] = await sql`select value from settings where key = ${'look:' + job}`; return (r && r.value) || null; }

// GET ?job=X          the colour rules of the job (first time: copied from what Revit sent)
// GET ?job=X&compute=1 the colour of every part worked out from the rules and the part values: { colors: { rrggbb: [ids] } }
export async function GET(req) {
  const u = new URL(req.url);
  const job = u.searchParams.get('job') || '';
  if (!job || !canJob(await currentUser(), job)) return Response.json({ error: 'No access' }, { status: 403 });
  const sql = await db();
  let rules = await getColorRules(sql, job);
  if (!rules) {
    const look = await lookOf(sql, job);
    if (look && Array.isArray(look.filters) && look.filters.length) { rules = fromLook(look); await putColorRules(sql, job, rules); }
  }
  // copied from Revit before the add-in sent the conditions: take them as soon as Revit has sent them (rules edited on the website are never replaced)
  if (rules && rules.from === 'revit' && !rules.filters.some((f) => f.tree && f.tree.items && f.tree.items.length)) {
    const look = await lookOf(sql, job);
    if (look && Array.isArray(look.filters) && look.filters.some((f) => f.rules && f.rules.items && f.rules.items.length)) { rules = fromLook(look); await putColorRules(sql, job, rules); }
  }
  if (!rules) return Response.json({ rules: null, colors: {} });
  if (u.searchParams.get('compute') !== '1') return Response.json({ rules });
  const rows = await sql`select r.element_id, r.vals from rows r join schedules s on s.id = r.schedule_id where s.job = ${job} order by s.name`;
  const by = new Map();
  for (const r of rows) { const e = by.get(r.element_id); if (e) Object.assign(e.vals, r.vals || {}); else by.set(r.element_id, { element_id: r.element_id, vals: { ...(r.vals || {}) } }); }
  return Response.json({ colors: computeColors(rules, [...by.values()]), n: by.size });
}

// Admins only. PUT { job, rules } saves the rules; POST { job, action:'import' } copies Revit's view filters again (the rules edited here are replaced).
export async function PUT(req) {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || '').trim();
  const fs = b.rules && b.rules.filters;
  if (!job || !Array.isArray(fs)) return Response.json({ error: 'job and rules.filters are required' }, { status: 400 });
  const clean = { from: 'site', at: Date.now(), filters: fs.slice(0, 100).map((f, i) => ({ id: String(f.id || 'f' + i), name: String(f.name || '').slice(0, 80), color: String(f.color || '808080').replace('#', '').toLowerCase().slice(0, 6), enabled: f.enabled !== false, cats: Array.isArray(f.cats) ? f.cats.map(String) : [], tree: f.tree && Array.isArray(f.tree.items) ? f.tree : { logic: 'and', items: [] } })) };
  const sql = await db();
  await putColorRules(sql, job, clean);
  await bumpRev(sql, job, false, 'Colour rules');
  return Response.json({ ok: true });
}
export async function POST(req) {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || '').trim();
  if (!job || b.action !== 'import') return Response.json({ error: 'job and action import are required' }, { status: 400 });
  const sql = await db();
  const look = await lookOf(sql, job);
  if (!look || !Array.isArray(look.filters) || !look.filters.length) return Response.json({ error: 'Revit has not sent any colour filters for this job yet. Publish 3D once from Revit.' }, { status: 400 });
  const rules = fromLook(look);
  await putColorRules(sql, job, rules);
  await bumpRev(sql, job, false, 'Colour rules');
  return Response.json({ ok: true, rules });
}

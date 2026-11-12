import { db } from '../../../lib/db';
import { currentUser, canJob, canEdit } from '../../../lib/user';
import { getColPerms, allowedCols } from '../../../lib/colperms';
const nk = (s) => String(s ?? '').toLowerCase().replace(/[\s\-_]/g, '');
export const dynamic = 'force-dynamic';
// Schedule rows for given Revit element ids inside one job (used by the 3D model popup).
export async function GET(req) {
  const u = new URL(req.url);
  const job = u.searchParams.get('job') || '';
  if (!canJob(await currentUser(), job)) return Response.json({ error: 'No access' }, { status: 403 });
  const ids = (u.searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 50);
  if (!ids.length) return Response.json([]);
  const sql = await db();
  const rows = job
    ? await sql`select s.id, s.name, s.columns, r.element_id, r.vals from rows r join schedules s on s.id = r.schedule_id where s.job = ${job} and r.element_id = any(${ids}::text[]) order by s.name`
    : await sql`select s.id, s.name, s.columns, r.element_id, r.vals from rows r join schedules s on s.id = r.schedule_id where s.job is null and r.element_id = any(${ids}::text[]) order by s.name`;
  const u2 = await currentUser();
  const only = allowedCols(u2, await getColPerms());
  const out = rows.map((r) => {
    const cols = Array.isArray(r.columns) ? r.columns : [];
    const editable = cols.filter((c) => c && c.type === 'bool' && !c.readOnly && (only ? only.some((o) => nk(o) === nk(c.name)) : canEdit(u2))).map((c) => c.name);
    return { ...r, editable, me: (u2 && (u2.name || u2.email)) || 'Admin' };
  });
  return Response.json(out);
}

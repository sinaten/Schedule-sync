import { db } from '../../../lib/db';
import { currentUser, canJob } from '../../../lib/user';
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
  return Response.json(rows);
}

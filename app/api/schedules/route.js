import { db } from '../../../lib/db';
import { currentUser, canJob } from '../../../lib/user';
export const dynamic = 'force-dynamic';
// Only the schedules of the jobs this person may open.
export async function GET() {
  const u = await currentUser();
  if (!u) return Response.json({ error: 'Login required' }, { status: 401 });
  const sql = await db();
  const rows = await sql`select id, name, job, updated_at from schedules order by name`;
  return Response.json(rows.filter((r) => canJob(u, r.job || '')).map(({ id, name, updated_at }) => ({ id, name, updated_at })));
}

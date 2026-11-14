import { currentUser, canJob } from '../../../lib/user';
import { snapsDb } from '../../../lib/snaps';
export const dynamic = 'force-dynamic';

// The snapshots marked "show" for a job, for people who may use that job.
export async function GET(req) {
  const job = new URL(req.url).searchParams.get('job') || '';
  const u = await currentUser();
  if (!u || !job || !canJob(u, job)) return Response.json({ snaps: [] });
  const sql = await snapsDb();
  const rows = await sql`select id, name from snaps where job = ${job} and show order by id`;
  return Response.json({ snaps: rows.map((r) => ({ id: r.id, name: r.name, url: '/api/snap/file?id=' + r.id })) });
}

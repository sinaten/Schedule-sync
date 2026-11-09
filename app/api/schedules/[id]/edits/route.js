import { db } from '../../../../../lib/db';
import { currentUser, canJob, canEdit } from '../../../../../lib/user';
export async function POST(req, { params }) {
  const id = decodeURIComponent(params.id);
  const { elementId, col, value } = await req.json();
  const sql = await db();
  const u = await currentUser();
  const [s] = await sql`select job from schedules where id=${id}`;
  if (!s) return Response.json({ error: 'not found' }, { status: 404 });
  if (!canEdit(u) || !canJob(u, s.job || '')) return Response.json({ error: 'You cannot edit this schedule' }, { status: 403 });
  await sql`delete from edits where schedule_id=${id} and element_id=${elementId} and col=${col} and status='pending'`;
  await sql`insert into edits(schedule_id,element_id,col,value) values(${id},${elementId},${col},${JSON.stringify(value)}::jsonb)`;
  return Response.json({ ok: true });
}

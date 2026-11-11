import { db } from '../../../../lib/db';
import { currentUser, canJob, canEdit } from '../../../../lib/user';
import { getColPerms, allowedCols } from '../../../../lib/colperms';
export const dynamic = 'force-dynamic';
export async function GET(_, { params }) {
  const id = decodeURIComponent(params.id);
  const sql = await db();
  const [s] = await sql`select id, name, job, columns, updated_at from schedules where id=${id}`;
  if (!s) return Response.json({ error: 'not found' }, { status: 404 });
  const u = await currentUser();
  if (!canJob(u, s.job || '')) return Response.json({ error: 'No access' }, { status: 403 });
  const rows = await sql`select element_id, vals from rows where schedule_id=${id} order by element_id::bigint nulls last, element_id`;
  const pending = await sql`select element_id, col, value from edits where schedule_id=${id} and status='pending'`;
  const failed = await sql`select element_id, col, note from edits where schedule_id=${id} and status='failed' order by id desc limit 20`;
  // editCols: null = the old rule (canEdit), otherwise only these Yes/No columns may be changed by this person
  const editCols = allowedCols(u, await getColPerms());
  return Response.json({ ...s, rows, pending, failed, canEdit: canEdit(u), editCols });
}

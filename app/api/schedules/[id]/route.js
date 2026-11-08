import { db } from '../../../../lib/db';
export const dynamic = 'force-dynamic';
export async function GET(_, { params }) {
  const id = decodeURIComponent(params.id);
  const sql = await db();
  const [s] = await sql`select id, name, job, columns, updated_at from schedules where id=${id}`;
  if (!s) return Response.json({ error: 'not found' }, { status: 404 });
  const rows = await sql`select element_id, vals from rows where schedule_id=${id} order by element_id::bigint nulls last, element_id`;
  const pending = await sql`select element_id, col, value from edits where schedule_id=${id} and status='pending'`;
  const failed = await sql`select element_id, col, note from edits where schedule_id=${id} and status='failed' order by id desc limit 20`;
  return Response.json({ ...s, rows, pending, failed });
}

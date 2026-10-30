import { db } from '../../../../../lib/db';
export async function POST(req, { params }) {
  const id = decodeURIComponent(params.id);
  const { elementId, col, value } = await req.json();
  const sql = await db();
  await sql`delete from edits where schedule_id=${id} and element_id=${elementId} and col=${col} and status='pending'`;
  await sql`insert into edits(schedule_id,element_id,col,value) values(${id},${elementId},${col},${JSON.stringify(value)}::jsonb)`;
  return Response.json({ ok: true });
}

import { db } from '../../../../lib/db';
import { currentUser, isAdmin } from '../../../../lib/user';
export const dynamic = 'force-dynamic';

// Admins only: remove one job (its schedules, rows, edits, 3D model, colours and ticks). Photos and issues are kept.
export async function DELETE(req) {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const job = new URL(req.url).searchParams.get('job') || '';
  if (!job) return Response.json({ error: 'No job' }, { status: 400 });
  const sql = await db();
  const ids = (await sql`select id from schedules where job = ${job}`).map((x) => x.id);
  if (ids.length) {
    await sql`delete from rows where schedule_id = any(${ids}::text[])`;
    await sql`delete from edits where schedule_id = any(${ids}::text[])`;
    await sql`delete from schedules where id = any(${ids}::text[])`;
  }
  const keys = ['model:' + job, 'look:' + job, 'looks:' + job, 'ifc:' + job];
  await sql`delete from settings where key = any(${keys}::text[]) or starts_with(key, ${'layer:' + job + ':'})`;
  return Response.json({ ok: true, schedules: ids.length });
}

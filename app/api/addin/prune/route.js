import { db, isAddin, deny } from '../../../../lib/db';
// Add-in sends { job, src, keep:[scheduleUniqueIds] }: schedules of this job that came from this Revit file but are no longer in it get removed.
export async function POST(req) {
  if (!isAddin(req)) return deny();
  const { job, src, keep } = await req.json();
  if (!job || !src || !Array.isArray(keep)) return Response.json({ removed: 0 });
  const sql = await db();
  const gone = await sql`select id from schedules where job = ${job} and (src = ${src} or src is null) and id <> all(${keep}::text[])`;
  const ids = gone.map((g) => g.id);
  if (ids.length) {
    await sql`delete from rows where schedule_id = any(${ids}::text[])`;
    await sql`delete from edits where schedule_id = any(${ids}::text[])`;
    await sql`delete from schedules where id = any(${ids}::text[])`;
  }
  return Response.json({ removed: ids.length });
}

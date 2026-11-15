import { db, isAddin, deny } from '../../../../lib/db';
// Add-in polls this for edits made on the website.
export async function GET(req) {
  if (!isAddin(req)) return deny();
  const sql = await db();
  // newest change wins: an edit made on the website BEFORE Revit changed the same part is old - it is not sent to Revit
  await sql`update edits e set status='rejected', note='Revit changed this part later' from rows r where e.status='pending' and r.schedule_id = e.schedule_id and r.element_id = e.element_id and r.changed_at is not null and r.changed_at > e.created_at`;
  const edits = await sql`select id, schedule_id as "scheduleId", element_id as "elementId", col as "column", value from edits where status='pending' order by id`;
  return Response.json({ edits });
}

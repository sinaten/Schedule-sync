import { db, isAddin, deny } from '../../../../lib/db';
// Add-in polls this for edits made on the website.
export async function GET(req) {
  if (!isAddin(req)) return deny();
  const sql = await db();
  const edits = await sql`select id, schedule_id as "scheduleId", element_id as "elementId", col as "column", value from edits where status='pending' order by id`;
  return Response.json({ edits });
}

import { db, isAddin, deny } from '../../../../lib/db';
import { getLayer, putLayer } from '../../../../lib/layer';
// Revit add-in ("Sync user"): moves one user's layer into the real data. Their changes become normal pending edits that the add-in writes into Revit; the layer is cleared.
// POST { job, username } -> { moved }
export async function POST(req) {
  if (!isAddin(req)) return deny();
  const b = await req.json().catch(() => ({}));
  const job = b.job || '';
  const username = String(b.username || '');
  if (!username) return Response.json({ error: 'username required' }, { status: 400 });
  const sql = await db();
  const L = await getLayer(sql, job, username);
  let moved = 0;
  for (const e of L.edits) {
    await sql`delete from edits where schedule_id=${e.scheduleId} and element_id=${e.elementId} and col=${e.col} and status='pending'`;
    await sql`insert into edits(schedule_id,element_id,col,value) values(${e.scheduleId},${e.elementId},${e.col},${JSON.stringify(e.value)}::jsonb)`;
    moved++;
  }
  await putLayer(sql, job, username, { edits: [], look: null, rev: (L.rev || 0) + 1 });
  return Response.json({ moved });
}

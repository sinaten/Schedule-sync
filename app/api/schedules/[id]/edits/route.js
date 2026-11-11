import { db } from '../../../../../lib/db';
import { currentUser, canJob, canEdit } from '../../../../../lib/user';
import { getColPerms, allowedCols } from '../../../../../lib/colperms';
import { histDb } from '../../../../../lib/history';
export async function POST(req, { params }) {
  const id = decodeURIComponent(params.id);
  const { elementId, col, value } = await req.json();
  const sql = await db();
  const u = await currentUser();
  const [s] = await sql`select job, columns from schedules where id=${id}`;
  if (!s) return Response.json({ error: 'not found' }, { status: 404 });
  // A person with a list from Revit (SINA-TAEIDI > Site access) may change exactly those Yes/No columns; everyone else follows the old rule.
  const only = allowedCols(u, await getColPerms());
  if (only) {
    const c = (Array.isArray(s.columns) ? s.columns : []).find((x) => x && x.name === col);
    if (!u || !canJob(u, s.job || '') || !c || c.type !== 'bool' || c.readOnly || !only.includes(col) || typeof value !== 'boolean')
      return Response.json({ error: 'You cannot change this column' }, { status: 403 });
  } else if (!canEdit(u) || !canJob(u, s.job || '')) return Response.json({ error: 'You cannot edit this schedule' }, { status: 403 });
  // for History: what the value was before
  let before = null;
  if (typeof value === 'boolean') {
    const [r] = await sql`select vals ->> ${col} as v from rows where schedule_id=${id} and element_id=${elementId}`;
    before = r && r.v === 'true' ? true : r && r.v === 'false' ? false : null;
  }
  await sql`delete from edits where schedule_id=${id} and element_id=${elementId} and col=${col} and status='pending'`;
  await sql`insert into edits(schedule_id,element_id,col,value) values(${id},${elementId},${col},${JSON.stringify(value)}::jsonb)`;
  if (typeof value === 'boolean' && before !== value) {
    try {
      const h = await histDb();
      const change = [{ element: String(elementId), name: String(elementId), param: String(col), from: before, to: value, at: new Date().toISOString() }];
      await h`insert into history(username, job, changes) values(${(u && u.name) || 'admin'}, ${s.job || null}, ${JSON.stringify(change)}::jsonb)`;
    } catch {}
  }
  return Response.json({ ok: true });
}

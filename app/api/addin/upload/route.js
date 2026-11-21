import { db, isAddin, deny } from '../../../../lib/db';
import { bumpRev } from '../../../../lib/rev';
import { blocked } from '../../../../lib/jobstate';
import { ensureFolder } from '../../../../lib/folders';
// Add-in sends: { id, name, hash, columns:[{name,type:'bool'|'number'|'text',readOnly,unit?}], rows:[{elementId, values:{col:value}}] }
export async function POST(req) {
  if (!await isAddin(req)) return deny();
  const { id, name, hash, columns, rows, job, src } = await req.json();
  const sql = await db();
  if (await blocked(sql, job)) return Response.json({ changed: false, inactive: true }); // inactive / deleted job: nothing is stored
  await ensureFolder(sql, job);
  const [old] = await sql`select hash from schedules where id=${id}`;
  if (old && old.hash === hash) { if (src) await sql`update schedules set src=${src} where id=${id}`; return Response.json({ changed: false }); }
  await sql`insert into schedules(id,name,columns,hash,updated_at,job,src) values(${id},${name},${JSON.stringify(columns)}::jsonb,${hash},now(),${job || null},${src || null})
            on conflict(id) do update set name=excluded.name, columns=excluded.columns, hash=excluded.hash, job=excluded.job, src=excluded.src, updated_at=now()`;
  const before = await sql`select element_id, vals from rows where schedule_id=${id}`;
  await sql`delete from rows where schedule_id=${id}`;
  await sql`insert into rows(schedule_id,element_id,vals) select ${id}, r->>'elementId', r->'values' from jsonb_array_elements(${JSON.stringify(rows)}::jsonb) r`;
  // time stamp: parts whose values Revit changed now get the time of this change (a website edit made before it is then older and is not applied)
  if (before.length) {
    const canon = (o) => JSON.stringify(Object.keys(o || {}).sort().map((k) => [k, o[k]])); // same order on both sides
    const old = new Map(before.map((r) => [r.element_id, canon(r.vals)]));
    const changed = rows.filter((r) => old.has(String(r.elementId)) && old.get(String(r.elementId)) !== canon(r.values)).map((r) => String(r.elementId));
    if (changed.length) await sql`update rows set changed_at = now() where schedule_id=${id} and element_id = any(${changed}::text[])`;
  }
  await bumpRev(sql, job, false); // other people on this job bring their page up to date
  return Response.json({ changed: true, rows: rows.length });
}

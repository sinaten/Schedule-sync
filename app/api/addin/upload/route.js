import { db, isAddin, deny } from '../../../../lib/db';
// Add-in sends: { id, name, hash, columns:[{name,type:'bool'|'number'|'text',readOnly,unit?}], rows:[{elementId, values:{col:value}}] }
export async function POST(req) {
  if (!isAddin(req)) return deny();
  const { id, name, hash, columns, rows, job } = await req.json();
  const sql = await db();
  const [old] = await sql`select hash from schedules where id=${id}`;
  if (old && old.hash === hash) return Response.json({ changed: false });
  await sql`insert into schedules(id,name,columns,hash,updated_at,job) values(${id},${name},${JSON.stringify(columns)}::jsonb,${hash},now(),${job || null})
            on conflict(id) do update set name=excluded.name, columns=excluded.columns, hash=excluded.hash, job=excluded.job, updated_at=now()`;
  await sql`delete from rows where schedule_id=${id}`;
  await sql`insert into rows(schedule_id,element_id,vals) select ${id}, r->>'elementId', r->'values' from jsonb_array_elements(${JSON.stringify(rows)}::jsonb) r`;
  return Response.json({ changed: true, rows: rows.length });
}

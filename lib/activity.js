import { db } from './db';
let ready;
// Usage log: who did something that changes the model or asks Autodesk (kind: change = a change reached the job, model = a whole 3D model was published (uses Autodesk tokens), view = a page asked Autodesk for the model).
export async function activityDb() {
  const sql = await db();
  ready ??= (async () => {
    await sql`create table if not exists activity(id serial primary key, at timestamptz default now(), who text, job text, kind text)`;
    await sql`create index if not exists activity_at_idx on activity(at desc)`;
  })();
  try { await ready; } catch (e) { ready = undefined; throw e; }
  return sql;
}
export async function logActivity(sql, who, job, kind) {
  try {
    const s = await activityDb();
    await s`insert into activity(who, job, kind) values(${who || ''}, ${job || ''}, ${kind})`;
  } catch (e) {}
}

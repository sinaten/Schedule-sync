import { db } from './db';
let ready;
// Snapshots: pictures of Revit views, shown to the people who may use the job.
export async function snapsDb() {
  const sql = await db();
  ready ??= (async () => {
    await sql`create table if not exists snaps(id serial primary key, job text not null, name text not null default '', pathname text not null, show boolean not null default true, created_at timestamptz default now())`;
  })();
  await ready;
  return sql;
}

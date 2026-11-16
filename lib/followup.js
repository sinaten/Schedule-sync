import { db } from './db';
let ready;
// Items of the Follow-up page: one list per bar (Action Plan, Workflow, ...) of a job.
export const BARS = ['Action Plan', 'Workflow', 'Location', 'HSE', 'Communication', 'Orders', 'Utility'];
export async function followDb() {
  const sql = await db();
  ready ??= (async () => {
    await sql`create table if not exists followup_items(id serial primary key, job text not null, bar text not null, body text not null, author text, created_at timestamptz default now())`;
  })();
  await ready;
  return sql;
}

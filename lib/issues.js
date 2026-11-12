import { db } from './db';
let ready;
// Tables for issues: one issue per part (job + element), with its comments, photos and files.
export async function issuesDb() {
  const sql = await db();
  ready ??= (async () => {
    await sql`create table if not exists issues(job text not null, element_id text not null, description text not null default '', author text, created_at timestamptz default now(), updated_at timestamptz default now(), primary key(job, element_id))`;
    await sql`create table if not exists issue_items(id serial primary key, job text not null, element_id text not null, kind text not null, author text, body text, pathname text, name text, content_type text, created_at timestamptz default now())`;
  })();
  await ready;
  return sql;
}

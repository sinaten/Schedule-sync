import { db } from './db';
let ready;
// Tables for issues: one issue per part (job + element), with its comments, photos and files.
export async function issuesDb() {
  const sql = await db();
  ready ??= (async () => {
    await sql`create table if not exists issues(job text not null, element_id text not null, description text not null default '', author text, created_at timestamptz default now(), updated_at timestamptz default now(), primary key(job, element_id))`;
    await sql`create table if not exists issue_items(id serial primary key, job text not null, element_id text not null, kind text not null, author text, body text, pathname text, name text, content_type text, created_at timestamptz default now())`;
    // action plan of an issue (made by a manager or editor): how to solve it, who does it, its own running job number
    await sql`create table if not exists action_plans(job text not null, element_id text not null, no int not null, body text not null default '', status text not null default 'open', assignees jsonb not null default '[]'::jsonb, author text, created_at timestamptz default now(), updated_at timestamptz default now(), primary key(job, element_id))`;
    await sql`alter table action_plans add column if not exists updated_by text`;
    await sql`alter table action_plans add column if not exists job_no text`;
    await sql`alter table action_plans add column if not exists start_date text`;
    await sql`alter table action_plans add column if not exists end_date text`;
    await sql`alter table issue_items add column if not exists scope text not null default 'issue'`;
    // card number (one running number per job) and status of every issue
    await sql`alter table issues add column if not exists no int`;
    await sql`alter table issues add column if not exists status text not null default 'open'`;
    await sql`alter table issues add column if not exists priority text not null default 'noncritical'`;
    await sql`update issues i set no = r.rn + coalesce((select max(no) from issues x where x.job = i.job), 0)
      from (select job, element_id, row_number() over (partition by job order by created_at, element_id) rn from issues where no is null) r
      where i.job = r.job and i.element_id = r.element_id and i.no is null`;
  })();
  await ready;
  return sql;
}

export const STATUSES = ['open', 'prog', 'ready', 'done', 'closed'];
export const PRIORITIES = ['critical', 'noncritical'];
export const jobNo = (n) => 'JOB-' + String(n || 0).padStart(4, '0');
export const cardNo = (n) => 'ISS-' + String(n || 0).padStart(4, '0');

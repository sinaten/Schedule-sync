import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
let ready;
export async function db() {
  ready ??= (async () => {
    await sql`create table if not exists schedules(id text primary key, name text, columns jsonb, hash text, updated_at timestamptz default now())`;
    await sql`alter table schedules add column if not exists job text`; await sql`alter table schedules add column if not exists src text`; await sql`create table if not exists users(username text primary key, pass_hash text, salt text, role text, jobs jsonb default '[]'::jsonb, created_at timestamptz default now())`; await sql`create table if not exists settings(key text primary key, value jsonb)`; await sql`create table if not exists rows(schedule_id text, element_id text, vals jsonb, primary key(schedule_id, element_id))`;
    await sql`create table if not exists edits(id serial primary key, schedule_id text, element_id text, col text, value jsonb, status text default 'pending', note text, created_at timestamptz default now())`;
  })();
  await ready;
  return sql;
}
export const isAddin = (req) => !!process.env.API_KEY && req.headers.get('x-api-key') === process.env.API_KEY;
export const deny = () => Response.json({ error: 'bad api key' }, { status: 401 });

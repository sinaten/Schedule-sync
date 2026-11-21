import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
const sql = neon(process.env.DATABASE_URL, { fetchOptions: { cache: 'no-store' } });
let ready;
export async function db() {
  ready ??= (async () => {
    await sql`create table if not exists schedules(id text primary key, name text, columns jsonb, hash text, updated_at timestamptz default now())`;
    await sql`alter table schedules add column if not exists job text`; await sql`alter table schedules add column if not exists src text`; await sql`create table if not exists users(username text primary key, pass_hash text, salt text, role text, jobs jsonb default '[]'::jsonb, created_at timestamptz default now())`; await sql`create table if not exists settings(key text primary key, value jsonb)`; await sql`create table if not exists rows(schedule_id text, element_id text, vals jsonb, primary key(schedule_id, element_id))`;
    await sql`alter table rows add column if not exists changed_at timestamptz`; // when Revit last changed this part's values (newest change wins)
    await sql`create table if not exists followers(id serial primary key, name text unique, key_hash text unique, active boolean default true, created_at timestamptz default now(), last_seen timestamptz)`;
    await sql`create table if not exists edits(id serial primary key, schedule_id text, element_id text, col text, value jsonb, status text default 'pending', note text, created_at timestamptz default now())`;
  })();
  await ready;
  return sql;
}
export const hashKey = (k) => createHash('sha256').update(String(k)).digest('hex');
// The Revit add-in key. The main key (API_KEY) can do everything. A follower key (made in Admin > Followers) can only READ (GET) and
// only while its follower is connected; it is stored hashed and its last use is noted (at most once a minute).
export async function isAddin(req) {
  const k = req.headers.get('x-api-key') || '';
  if (!k) return false;
  if (process.env.API_KEY && k === process.env.API_KEY) return true;
  if (!k.startsWith('fk_')) return false;
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  try {
    const q = await db();
    const h = hashKey(k);
    const [f] = await q`select id, active from followers where key_hash = ${h}`;
    if (!f || !f.active) return false;
    await q`update followers set last_seen = now() where id = ${f.id} and (last_seen is null or last_seen < now() - interval '60 seconds')`;
    return true;
  } catch (e) { return false; }
}
export const deny = () => Response.json({ error: 'bad api key' }, { status: 401 });

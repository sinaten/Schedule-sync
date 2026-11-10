import { db } from './db';

// Site visits (one per capture session) and the photos / videos saved in each.
export async function visitsDb() {
  const sql = await db();
  await sql`create table if not exists sections(id text primary key, job text not null, name text not null, pos int default 0, created_at timestamptz default now())`;
  await sql`alter table sections add column if not exists share text`;
  await sql`create table if not exists visits(id text primary key, job text not null, section_id text, section_name text, folder text not null, username text, lat double precision, lng double precision, acc double precision, created_at timestamptz default now())`;
  await sql`create table if not exists media(id text primary key, visit_id text not null, pathname text not null, kind text, size bigint, content_type text, created_at timestamptz default now())`;
  return sql;
}

export const safe = (s, n = 40) => String(s || '').normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, n) || 'x';

export function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + '_' + p(d.getUTCHours()) + '-' + p(d.getUTCMinutes()) + '-' + p(d.getUTCSeconds());
}

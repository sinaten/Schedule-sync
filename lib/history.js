import { db } from './db';

// History of commissioning stage changes: one record per user per snapshot, taken every N hours (set in Admin > Settings > History).
// changes: [{ element, name, param, from, to, at }] - which element's Yes/No parameter went from which value to which, and when.
export const HIST_DEFAULT = { hours: 24 };

export async function histDb() {
  const sql = await db();
  await sql`create table if not exists history(id serial primary key, username text, job text, taken_at timestamptz default now(), lat double precision, lng double precision, changes jsonb default '[]'::jsonb)`;
  await sql`create index if not exists history_user_idx on history(username, taken_at desc)`;
  return sql;
}

export async function getHistRules() {
  const sql = await db();
  const [r] = await sql`select value from settings where key = 'history_rules'`;
  const h = Number(r && r.value && r.value.hours);
  return Number.isFinite(h) && h >= 1 && h <= 168 ? { hours: Math.round(h) } : HIST_DEFAULT;
}

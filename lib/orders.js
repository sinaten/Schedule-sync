import { db } from './db';
let ready;
// Orders of a job: what was ordered, who ordered it, where it is dropped off (a Scenario of the site), and the tracking number with its short status.
export const STATUS = ['unknown', 'created', 'transit', 'out', 'delivered', 'delayed'];
export async function ordersDb() {
  const sql = await db();
  ready ??= (async () => {
    await sql`create table if not exists orders(id serial primary key, job text not null, title text not null, details text, author text, drop_token text, drop_name text, tracking text, carrier text, status text default 'unknown', status_note text, eta text, last_scan text, checked_at timestamptz, created_at timestamptz default now())`;
  })();
  await ready;
  return sql;
}
// The carrier from the look of the number (UPS, FedEx, USPS); '' when it is not one of them.
export function carrierOf(t) {
  const s = String(t || '').replace(/[\s-]/g, '').toUpperCase();
  if (!s) return '';
  if (/^1Z[0-9A-Z]{16}$/.test(s)) return 'UPS';
  if (/^[A-Z]{2}\d{9}US$/.test(s)) return 'USPS';
  if (/^(94|93|92|95)\d{18,20}$/.test(s)) return 'USPS';
  if (/^(96\d{20}|\d{12}|\d{15})$/.test(s)) return 'FedEx';
  return '';
}
// The drop-off places of a job: the scenarios of the site the project is in ({ token, name }).
export async function dropsOf(sql, job) {
  const [m] = await sql`select value from settings where key = ${'projmeta:' + job}`;
  const site = m && m.value && m.value.siteId;
  if (!site) return [];
  const rows = await sql`select key, value from settings where starts_with(key, 'scn:') and value->>'site' = ${String(site)}`;
  return rows.map((r) => ({ token: r.key.slice(4), name: r.value.name || 'Scenario', at: r.value.at || 0 })).sort((a, b) => a.name.localeCompare(b.name)).map(({ token, name }) => ({ token, name }));
}

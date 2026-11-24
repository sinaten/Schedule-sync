import { db } from './db';
let ready;
// Orders of a job: what was ordered, who ordered it, where it is dropped off (a Scenario of the site), and the tracking number with its short status.
export const STATUS = ['unknown', 'created', 'transit', 'out', 'delivered', 'delayed'];
export async function ordersDb() {
  const sql = await db();
  ready ??= (async () => {
    await sql`create table if not exists orders(id serial primary key, job text not null, title text not null, details text, author text, drop_token text, drop_name text, tracking text, carrier text, status text default 'unknown', status_note text, eta text, last_scan text, checked_at timestamptz, created_at timestamptz default now())`;
    await sql`alter table orders add column if not exists elements text`;
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
// The scenarios of the site the project is in ({ token, name, drop, phones }). drop = the manager marked it as a delivery drop-off place.
export async function dropsOf(sql, job) {
  const [m] = await sql`select value from settings where key = ${'projmeta:' + job}`;
  const site = m && m.value && m.value.siteId;
  if (!site) return [];
  const rows = await sql`select key, value from settings where starts_with(key, 'scn:') and value->>'site' = ${String(site)}`;
  return rows.map((r) => ({ token: r.key.slice(4), name: r.value.name || 'Scenario', drop: !!r.value.drop, phones: Array.isArray(r.value.phones) ? r.value.phones : [] })).sort((a, b) => a.name.localeCompare(b.name));
}
// The element numbers of an order are kept as one text, comma between them.
export const elsOf = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
export const cleanEls = (a) => [...new Set((Array.isArray(a) ? a : []).map((x) => String(x == null ? '' : x).trim().replace(/[^\w-]/g, '').slice(0, 24)).filter(Boolean))].slice(0, 30);

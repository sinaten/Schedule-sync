import { db } from './db';

// Distance rings around the QR location (meters): green up to .green, orange up to .orange, red beyond. Set by the admin in Admin > Settings.
export const LOC_DEFAULT = { green: 10, orange: 100 };

export async function getLoc() {
  const sql = await db();
  const [r] = await sql`select value from settings where key = 'location_rules'`;
  const v = (r && r.value) || {};
  const g = Number(v.green), o = Number(v.orange);
  if (Number.isFinite(g) && Number.isFinite(o) && g >= 1 && o > g) return { green: g, orange: o };
  return LOC_DEFAULT;
}

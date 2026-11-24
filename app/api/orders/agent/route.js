import { currentUser, isAdmin } from '../../../../lib/user';
import { ordersDb } from '../../../../lib/orders';
export const dynamic = 'force-dynamic';

// POST { on: true|false }: admins only. Turns the tracking agent on or off (off = no tokens used, Check now and the daily run do nothing).
export async function POST(req) {
  const u = await currentUser();
  if (!u || !(isAdmin(u) || u.legacy)) return Response.json({ error: 'No access' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const sql = await ordersDb();
  await sql`insert into settings(key, value) values('trackagent', ${JSON.stringify({ on: b.on === true })}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true, on: b.on === true });
}

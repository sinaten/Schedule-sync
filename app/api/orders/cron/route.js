import { ordersDb } from '../../../../lib/orders';
import { checkTracking } from '../../../../lib/trackagent';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Once a day (Vercel cron): every order with a tracking number that is not delivered yet (made in the last 60 days) is looked up again.
// Only Vercel's cron may call it: it sends "Authorization: Bearer <CRON_SECRET>". Without CRON_SECRET set in Vercel nothing runs.
export async function GET(req) {
  const sec = process.env.CRON_SECRET;
  if (!sec || req.headers.get('authorization') !== 'Bearer ' + sec) return Response.json({ error: 'No access' }, { status: 401 });
  const sql = await ordersDb();
  const rows = await sql`select id, job, tracking, carrier from orders where tracking is not null and tracking <> '' and status <> 'delivered' and created_at > now() - interval '60 days' order by checked_at nulls first limit 30`;
  let done = 0, found = 0;
  for (const o of rows) {
    const r = await checkTracking(o.tracking, o.carrier || '');
    if (!r.ok) { if (r.reason === 'nokey' || r.reason === 'badkey' || r.reason === 'limit') break; continue; }
    done++;
    if (r.found) { found++; await sql`update orders set status = ${r.status}, carrier = coalesce(${r.carrier}, carrier), eta = ${r.eta}, last_scan = ${r.last_scan}, checked_at = now() where id = ${o.id}`; }
    else await sql`update orders set checked_at = now() where id = ${o.id}`;
  }
  return Response.json({ ok: true, looked: done, found });
}

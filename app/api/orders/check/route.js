import { currentUser, canJob, canEdit } from '../../../../lib/user';
import { ordersDb } from '../../../../lib/orders';
import { checkTracking } from '../../../../lib/trackagent';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const no = () => Response.json({ error: 'No access' }, { status: 403 });

// POST { job, id }: look the tracking number of one order up now (editors and admins; not more than once in 10 minutes for the same order).
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || ''), id = parseInt(b.id, 10);
  const u = await currentUser();
  if (!u || !job || !id || !canJob(u, job) || !canEdit(u)) return no();
  const sql = await ordersDb();
  const [o] = await sql`select tracking, carrier, checked_at from orders where id = ${id} and job = ${job}`;
  if (!o || !o.tracking) return Response.json({ error: 'No tracking number yet.' }, { status: 400 });
  if (o.checked_at && Date.now() - new Date(o.checked_at).getTime() < 10 * 60 * 1000) return Response.json({ ok: true, skipped: true });
  const r = await checkTracking(o.tracking, o.carrier || '');
  if (!r.ok) return Response.json({ error: r.reason === 'nokey' ? 'The tracking agent is not connected yet (the Anthropic key is not set in Vercel).' : r.reason === 'badkey' ? 'The Anthropic key was refused.' : r.reason === 'limit' ? 'The Anthropic credit or rate limit was reached.' : 'The lookup failed. Try again later.' }, { status: 503 });
  if (r.found) await sql`update orders set status = ${r.status}, carrier = coalesce(${r.carrier}, carrier), eta = ${r.eta}, last_scan = ${r.last_scan}, checked_at = now() where id = ${id} and job = ${job}`;
  else await sql`update orders set checked_at = now() where id = ${id} and job = ${job}`;
  return Response.json({ ok: true, found: !!r.found });
}

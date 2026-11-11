import { db } from '../../../lib/db';
import { currentUser, canJob, canEdit } from '../../../lib/user';
export const dynamic = 'force-dynamic';
// The phone asks Revit (through the add-in) to publish the 3D model again, and watches how it goes.
const put = (sql, k, v) => sql`insert into settings(key, value) values(${k}, ${JSON.stringify(v)}::jsonb) on conflict (key) do update set value = excluded.value`;
const ONLINE_MS = 45000;
async function status(sql, job) {
  const [p] = await sql`select value from settings where key = ${'ping:' + job}`;
  const [r] = await sql`select value from settings where key = ${'refresh:' + job}`;
  const online = !!p && !!p.value && Date.now() - Number(p.value.at || 0) < ONLINE_MS;
  return { online, state: (r && r.value && r.value.state) || '', msg: (r && r.value && r.value.msg) || '', pct: r && r.value && typeof r.value.pct === 'number' ? r.value.pct : null };
}
export async function GET(req) {
  const job = new URL(req.url).searchParams.get('job') || '';
  const u = await currentUser();
  if (!job || !canJob(u, job)) return Response.json({ error: 'No access' }, { status: 403 });
  return Response.json(await status(await db(), job));
}
export async function POST(req) {
  const { job } = await req.json().catch(() => ({}));
  const u = await currentUser();
  if (!job || !canJob(u, job) || !canEdit(u)) return Response.json({ error: 'You cannot refresh this model' }, { status: 403 });
  const sql = await db();
  const s = await status(sql, job);
  if (!s.online) return Response.json({ ok: false, offline: true });
  await put(sql, 'refresh:' + job, { state: 'requested', msg: '', at: Date.now() });
  return Response.json({ ok: true });
}

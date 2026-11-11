import { db, isAddin, deny } from '../../../../lib/db';
export const dynamic = 'force-dynamic';
// The Revit add-in asks here (every few seconds) whether the phone wants the 3D model refreshed. Asking also tells the site that Revit is online.
const put = (sql, k, v) => sql`insert into settings(key, value) values(${k}, ${JSON.stringify(v)}::jsonb) on conflict (key) do update set value = excluded.value`;
export async function GET(req) {
  if (!isAddin(req)) return deny();
  const job = new URL(req.url).searchParams.get('job') || '';
  if (!job) return Response.json({ requested: false });
  const sql = await db();
  await put(sql, 'ping:' + job, { at: Date.now() });
  const [r] = await sql`select value from settings where key = ${'refresh:' + job}`;
  return Response.json({ requested: !!r && r.value && r.value.state === 'requested' });
}
export async function POST(req) {
  if (!isAddin(req)) return deny();
  const { job, state, msg } = await req.json();
  if (!job) return Response.json({ error: 'job' }, { status: 400 });
  const sql = await db();
  await put(sql, 'refresh:' + job, { state: String(state || ''), msg: String(msg || ''), at: Date.now() });
  return Response.json({ ok: true });
}

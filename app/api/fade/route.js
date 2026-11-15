import { db } from '../../../lib/db';
import { currentUser, isAdmin } from '../../../lib/user';
import { fadeKey, cleanFade, FADE_DEFAULTS } from '../../../lib/fade';
export const dynamic = 'force-dynamic';
// How much parts with no colour filter are faded toward white. Everyone signed in reads it (the 3D view needs it); only admins change it.
export async function GET() {
  if (!(await currentUser())) return Response.json({ error: 'No access' }, { status: 403 });
  const sql = await db();
  const [r] = await sql`select value from settings where key = ${fadeKey}`;
  return Response.json({ settings: cleanFade((r && r.value) || FADE_DEFAULTS) });
}
export async function PUT(req) {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const v = cleanFade(b.settings);
  const sql = await db();
  await sql`insert into settings(key, value) values(${fadeKey}, ${JSON.stringify(v)}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true, settings: v });
}

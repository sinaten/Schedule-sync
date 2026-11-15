import { db } from '../../../lib/db';
import { currentUser, isAdmin } from '../../../lib/user';
import { hatchKey, cleanHatch, HATCH_DEFAULTS } from '../../../lib/hatch';
export const dynamic = 'force-dynamic';
// The look of parts that match no colour filter. Everyone signed in reads it (the 3D view needs it); only admins change it.
export async function GET() {
  if (!(await currentUser())) return Response.json({ error: 'No access' }, { status: 403 });
  const sql = await db();
  const [r] = await sql`select value from settings where key = ${hatchKey}`;
  return Response.json({ settings: cleanHatch((r && r.value) || HATCH_DEFAULTS) });
}
export async function PUT(req) {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const v = cleanHatch(b.settings);
  const sql = await db();
  await sql`insert into settings(key, value) values(${hatchKey}, ${JSON.stringify(v)}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true, settings: v });
}

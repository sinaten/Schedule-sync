import { currentUser, isAdmin } from '../../../../lib/user';
import { db } from '../../../../lib/db';
import { idKey, cleanIdFormat, getIdFormat, makeId, projectContext, PARTS } from '../../../../lib/ids';
export const dynamic = 'force-dynamic';

const no = () => Response.json({ error: 'Admins only' }, { status: 403 });
// Admins only. GET = the format. PUT = save it. POST { job, format? } = build ONE sample ID (nothing is stored).
export async function GET() {
  if (!isAdmin(await currentUser())) return no();
  return Response.json({ format: await getIdFormat(await db()), parts: PARTS });
}
export async function PUT(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const f = cleanIdFormat(b && b.format);
  const sql = await db();
  await sql`insert into settings(key, value) values(${idKey}, ${JSON.stringify(f)}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true, format: f });
}
export async function POST(req) {
  const u = await currentUser();
  if (!isAdmin(u)) return no();
  const b = await req.json().catch(() => ({}));
  const sql = await db();
  const fmt = b && b.format ? cleanIdFormat(b.format) : await getIdFormat(sql);
  const ctx = await projectContext(sql, String((b && b.job) || ''));
  return Response.json({ id: makeId(fmt, { ...ctx, creator: (u && u.name) || 'sina', access: 0, version: 1 }), from: ctx.from });
}

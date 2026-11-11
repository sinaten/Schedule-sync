import { currentUser, isAdmin } from '../../../../lib/user';
import { isAddin, deny, db } from '../../../../lib/db';
import { getHistRules } from '../../../../lib/history';
export const dynamic = 'force-dynamic';

// How often a History record is taken. Admin sets it; the Revit add-in reads it (x-api-key).
export async function GET(req) {
  if (!isAddin(req) && !isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  return Response.json(await getHistRules());
}

export async function PUT(req) {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const h = Math.round(Number(b && b.hours));
  if (!Number.isFinite(h) || h < 1 || h > 168) return Response.json({ error: 'Hours must be between 1 and 168' }, { status: 400 });
  const sql = await db();
  await sql`insert into settings(key, value) values('history_rules', ${JSON.stringify({ hours: h })}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true, hours: h });
}

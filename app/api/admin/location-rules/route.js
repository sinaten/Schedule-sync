import { currentUser, isAdmin } from '../../../../lib/user';
import { db } from '../../../../lib/db';
import { getLoc } from '../../../../lib/locrules';
export const dynamic = 'force-dynamic';

const no = () => Response.json({ error: 'Admins only' }, { status: 403 });

// Admin: distance rings (meters) for the photo frames: green up to .green, orange up to .orange, red beyond.
export async function GET() {
  if (!isAdmin(await currentUser())) return no();
  return Response.json(await getLoc());
}

export async function PUT(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const g = Math.round(Number(b.green)), o = Math.round(Number(b.orange));
  if (!Number.isFinite(g) || !Number.isFinite(o) || g < 1 || o <= g || o > 100000) return Response.json({ error: 'Orange must be larger than green (1 to 100000 m)' }, { status: 400 });
  const sql = await db();
  await sql`insert into settings(key, value) values('location_rules', ${JSON.stringify({ green: g, orange: o })}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true });
}

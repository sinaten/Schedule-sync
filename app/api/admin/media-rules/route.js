import { currentUser, isAdmin } from '../../../../lib/user';
import { db } from '../../../../lib/db';
import { getRules } from '../../../../lib/mediarules';
export const dynamic = 'force-dynamic';

const no = () => Response.json({ error: 'Admins only' }, { status: 403 });

// Admin: how long regular users / editors may view and delete photos and videos after upload (minutes; null = no limit).
export async function GET() {
  if (!isAdmin(await currentUser())) return no();
  return Response.json(await getRules());
}

export async function PUT(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const out = {};
  for (const k of ['userView', 'userDelete', 'editorView', 'editorDelete']) {
    if (b[k] === null) { out[k] = null; continue; }
    const n = Number(b[k]);
    if (!Number.isFinite(n) || n < 0 || n > 525600) return Response.json({ error: 'Bad value for ' + k }, { status: 400 });
    out[k] = Math.round(n);
  }
  const sql = await db();
  await sql`insert into settings(key, value) values('media_rules', ${JSON.stringify(out)}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true });
}

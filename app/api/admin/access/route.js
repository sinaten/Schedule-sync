import { currentUser, isAdmin } from '../../../../lib/user';
import { db } from '../../../../lib/db';
import { getAccess, FEATURES } from '../../../../lib/access';
export const dynamic = 'force-dynamic';

const no = () => Response.json({ error: 'Admins only' }, { status: 403 });

// Admin: who (editors / regular users) may see which part of the site.
export async function GET() {
  if (!isAdmin(await currentUser())) return no();
  return Response.json({ features: FEATURES.map(([k, label]) => ({ key: k, label })), access: await getAccess() });
}

export async function PUT(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const out = {};
  for (const [k] of FEATURES) {
    const s = (b && b[k]) || {};
    out[k] = { editor: !!s.editor, viewer: !!s.viewer };
  }
  const sql = await db();
  await sql`insert into settings(key, value) values('access', ${JSON.stringify(out)}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true });
}

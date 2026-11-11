import { currentUser } from '../../../lib/user';
import { isAddin } from '../../../lib/db';
import { histDb } from '../../../lib/history';
export const dynamic = 'force-dynamic';

// Save one History record: who, when (now), where, and which stage parameters changed.
// Body: { username?, job?, lat?, lng?, changes: [{ element, name, param, from, to, at }] }. Allowed for the Revit add-in (x-api-key) or a signed-in user (then username is their own).
export async function POST(req) {
  const addin = isAddin(req);
  const u = addin ? null : await currentUser();
  if (!addin && !u) return Response.json({ error: 'Not signed in' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const username = addin ? String((b && b.username) || '').slice(0, 80) : u.name;
  if (!username) return Response.json({ error: 'username required' }, { status: 400 });
  const changes = (Array.isArray(b && b.changes) ? b.changes : []).slice(0, 2000).map((c) => ({
    element: String((c && c.element) || '').slice(0, 60),
    name: String((c && c.name) || '').slice(0, 120),
    param: String((c && c.param) || '').slice(0, 120),
    from: c && c.from === true ? true : c && c.from === false ? false : null,
    to: !!(c && c.to),
    at: (c && c.at) || null,
  }));
  const lat = Number(b && b.lat), lng = Number(b && b.lng);
  const sql = await histDb();
  await sql`insert into history(username, job, lat, lng, changes) values(${username}, ${String((b && b.job) || '') || null}, ${Number.isFinite(lat) ? lat : null}, ${Number.isFinite(lng) ? lng : null}, ${JSON.stringify(changes)}::jsonb)`;
  return Response.json({ ok: true, saved: changes.length });
}

import { db, isAddin, deny } from '../../../../lib/db';
import { getLayer, putLayer } from '../../../../lib/layer';
export const dynamic = 'force-dynamic';
// Revit add-in: which user layers of this job still need their colours worked out.
// GET ?job= -> { users: [{ username, rev, edits: [{ scheduleId, elementId, col, value }] }] }
export async function GET(req) {
  if (!isAddin(req)) return deny();
  const job = new URL(req.url).searchParams.get('job') || '';
  const prefix = 'layer:' + job + ':';
  const sql = await db();
  const rows = await sql`select key, value from settings where starts_with(key, ${prefix})`;
  const users = rows
    .map((r) => ({ username: r.key.slice(prefix.length), rev: (r.value && r.value.rev) || 0, edits: (r.value && r.value.edits) || [], look: r.value && r.value.look }))
    .filter((x) => !x.look && x.edits.length > 0)
    .map(({ username, rev, edits }) => ({ username, rev, edits }));
  return Response.json({ users });
}
// POST { job, username, rev, look: { colors } } -> kept only if the layer has not changed meanwhile
export async function POST(req) {
  if (!isAddin(req)) return deny();
  const b = await req.json().catch(() => ({}));
  const sql = await db();
  const L = await getLayer(sql, b.job || '', b.username);
  if (L.rev === b.rev && b.look) { L.look = { colors: b.look.colors || {} }; await putLayer(sql, b.job || '', b.username, L); return Response.json({ ok: true }); }
  return Response.json({ ok: false, stale: true });
}

import { currentUser, isAdmin } from '../../../../lib/user';
import { db } from '../../../../lib/db';
import { getIdFormat } from '../../../../lib/ids';
import { getCatalog } from '../../../../lib/idcat';
import { buildGuide, guideKey, notesKey } from '../../../../lib/idguide';
export const dynamic = 'force-dynamic';
const no = () => Response.json({ error: 'Admins only' }, { status: 403 });
const put = (sql, k, v) => sql`insert into settings(key, value) values(${k}, ${JSON.stringify(v)}::jsonb) on conflict (key) do update set value = excluded.value`;

// Admins only. GET = the guide built from the live settings (also saved in the database) + the admin's own notes. PUT { notes } saves the notes.
export async function GET() {
  if (!isAdmin(await currentUser())) return no();
  const sql = await db();
  const text = buildGuide(await getIdFormat(sql), await getCatalog(sql));
  const [n] = await sql`select value from settings where key = ${notesKey}`;
  const notes = String((n && n.value && n.value.text) || '');
  await put(sql, guideKey, { text, notes, at: new Date().toISOString() });
  return Response.json({ text, notes });
}
export async function PUT(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const sql = await db();
  await put(sql, notesKey, { text: String((b && b.notes) || '').slice(0, 8000) });
  return Response.json({ ok: true });
}

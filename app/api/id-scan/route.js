import { currentUser, isAdmin } from '../../../lib/user';
import { db } from '../../../lib/db';
import { pendKey, getCatalog, classify, pageKey, slug } from '../../../lib/idcat';
export const dynamic = 'force-dynamic';

// Only an admin's browser reports: the button labels it sees on a page. Labels the catalog does not know are kept as "new things found" (nothing else is stored).
export async function POST(req) {
  if (!isAdmin(await currentUser())) return new Response(null, { status: 204 });
  const b = await req.json().catch(() => ({}));
  const labels = (Array.isArray(b && b.items) ? b.items : []).map((x) => String(x || '').trim().slice(0, 60)).filter(Boolean).slice(0, 60);
  if (!labels.length) return Response.json({ added: 0 });
  const sql = await db();
  const cat = await getCatalog(sql);
  const pg = pageKey(b.path, b.tab);
  const [r] = await sql`select value from settings where key = ${pendKey}`;
  const items = Array.isArray(r && r.value && r.value.items) ? r.value.items : [];
  let added = 0;
  for (const l of labels) {
    if (classify(cat, l) !== null) continue;
    const key = pg + '|' + l.toLowerCase();
    if (items.some((x) => x.key === key) || items.length >= 300) continue;
    items.push({ key, page: pg, label: l, suggest: slug(l), at: new Date().toISOString() });
    added++;
  }
  if (added) await sql`insert into settings(key, value) values(${pendKey}, ${JSON.stringify({ items })}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ added });
}

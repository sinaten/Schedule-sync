import { currentUser, isAdmin } from '../../../../lib/user';
import { db } from '../../../../lib/db';
import { getIdFormat, cleanIdFormat, projectContext } from '../../../../lib/ids';
import { catKey, pendKey, getCatalog, cleanCatalog, typeId, slug, TOKENS } from '../../../../lib/idcat';
export const dynamic = 'force-dynamic';

const no = () => Response.json({ error: 'Admins only' }, { status: 403 });
const getPending = async (sql) => { const [r] = await sql`select value from settings where key = ${pendKey}`; return Array.isArray(r && r.value && r.value.items) ? r.value.items : []; };
const setPending = (sql, items) => sql`insert into settings(key, value) values(${pendKey}, ${JSON.stringify({ items })}::jsonb) on conflict (key) do update set value = excluded.value`;
const PAGE_OF = { 't-admin': 'ADMIN', 'b-media': 'GALLERY', 'b-phone': 'ISSUES' };

// Admins only. GET = catalog + new things found (?count=1: only the number). PUT { catalog } saves it.
// POST { job, catalog? } = one sample ID per type (nothing stored). PATCH { key, op: 'approve' | 'dismiss', action? } answers a new thing found.
export async function GET(req) {
  if (!isAdmin(await currentUser())) return no();
  const sql = await db();
  const pend = await getPending(sql);
  if (new URL(req.url).searchParams.get('count')) return Response.json({ pending: pend.length });
  return Response.json({ catalog: await getCatalog(sql), pending: pend, tokens: TOKENS });
}
export async function PUT(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const c = cleanCatalog(b && b.catalog);
  const sql = await db();
  await sql`insert into settings(key, value) values(${catKey}, ${JSON.stringify(c)}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true, catalog: c });
}
export async function POST(req) {
  const u = await currentUser();
  if (!isAdmin(u)) return no();
  const b = await req.json().catch(() => ({}));
  const sql = await db();
  const base = b && b.format ? cleanIdFormat(b.format) : await getIdFormat(sql);
  const cat = b && b.catalog ? cleanCatalog(b.catalog) : await getCatalog(sql);
  const ctx = await projectContext(sql, String((b && b.job) || ''));
  const samples = {};
  for (const t of cat.types) samples[t.key] = typeId(base, cat, t, { ...ctx, pageKey: PAGE_OF[t.key] || 'ISSUES', serial: 8, element: 1702105 });
  return Response.json({ samples, from: ctx.from });
}
export async function PATCH(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const sql = await db();
  const pend = await getPending(sql);
  const it = pend.find((x) => x.key === b.key);
  if (!it) return Response.json({ ok: true });
  if (b.op === 'approve') {
    const cat = await getCatalog(sql);
    const k = 'n-' + slug(it.label).toLowerCase();
    if (!cat.types.some((t) => t.key === k)) {
      const act = slug(b.action || it.suggest || it.label);
      cat.types.push({ key: k, group: 'button', name: it.label, desc: 'Found on page ' + it.page, code: '', word: 'BTN', action: act, labels: [String(it.label).toLowerCase()], parts: [{ k: 'page', on: true }, { k: 'type', on: true }, { k: 'action', on: true }], added: true });
      await sql`insert into settings(key, value) values(${catKey}, ${JSON.stringify(cleanCatalog(cat))}::jsonb) on conflict (key) do update set value = excluded.value`;
    }
  }
  await setPending(sql, pend.filter((x) => x.key !== b.key));
  return Response.json({ ok: true, pending: pend.length - 1 });
}

import { isAddin, deny } from '../../../../lib/db';
import { getQrConfig, sectionsDb } from '../../../../lib/qrcfg';
export const dynamic = 'force-dynamic';

// Revit add-in: which parameter names to use.
export async function GET(req) {
  if (!isAddin(req)) return deny();
  return Response.json(await getQrConfig());
}

// Revit add-in: send { job, names: [...] }. Every new name gets a QR (an existing one is reused, never changed).
// Returns { results: [{ name, url }] } where url is the public PDF download link.
export async function POST(req) {
  if (!isAddin(req)) return deny();
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || '').trim().slice(0, 80);
  const names = [...new Set((Array.isArray(b.names) ? b.names : []).map((x) => String(x || '').trim().slice(0, 120)).filter(Boolean))].slice(0, 2000);
  if (!job) return Response.json({ error: 'job is required' }, { status: 400 });
  const origin = new URL(req.url).origin;
  const sql = await sectionsDb();
  const [m] = await sql`select coalesce(max(pos), 0) as m from sections where job = ${job}`;
  let pos = Number(m.m);
  const results = [];
  for (const name of names) {
    const [old] = await sql`select id from sections where job = ${job} and name = ${name} order by created_at limit 1`;
    let id = old && old.id;
    if (!id) {
      id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      pos += 1;
      await sql`insert into sections(id, job, name, pos) values(${id}, ${job}, ${name}, ${pos})`;
    }
    results.push({ name, url: origin + '/qr/' + id });
  }
  return Response.json({ results });
}

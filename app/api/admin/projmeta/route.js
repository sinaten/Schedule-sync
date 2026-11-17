import { db } from '../../../../lib/db';
import { currentUser, isAdmin } from '../../../../lib/user';
import { cleanProject, cleanSite } from '../../../../lib/projmeta';
export const dynamic = 'force-dynamic';

const no = () => Response.json({ error: 'Admins only' }, { status: 403 });

// Admins only. GET = every project's settings and every site's shared settings.
// PUT { job, meta } saves one project; PUT { site, data } saves what all projects of that site inherit (site = "country>city>site").
export async function GET() {
  if (!isAdmin(await currentUser())) return no();
  const sql = await db();
  const r = await sql`select key, value from settings where starts_with(key, 'projmeta:') or starts_with(key, 'sitemeta:')`;
  const meta = {}, sites = {};
  for (const x of r) {
    if (x.key.startsWith('projmeta:')) meta[x.key.slice(9)] = cleanProject(x.value);
    else sites[x.key.slice(9)] = cleanSite(x.value);
  }
  return Response.json({ meta, sites });
}

export async function PUT(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const sql = await db();
  if (b.job) {
    const job = String(b.job).trim().slice(0, 100);
    if (!job) return Response.json({ error: 'No project' }, { status: 400 });
    await sql`insert into settings(key, value) values(${'projmeta:' + job}, ${JSON.stringify(cleanProject(b.meta))}::jsonb) on conflict (key) do update set value = excluded.value`;
    return Response.json({ ok: true });
  }
  if (b.site) {
    const key = String(b.site).trim().slice(0, 300);
    if (key.split('>').length !== 3 || key.split('>').some((x) => !x.trim())) return Response.json({ error: 'A site needs a country, a city and a site name' }, { status: 400 });
    await sql`insert into settings(key, value) values(${'sitemeta:' + key}, ${JSON.stringify(cleanSite(b.data))}::jsonb) on conflict (key) do update set value = excluded.value`;
    return Response.json({ ok: true });
  }
  return Response.json({ error: 'job or site is required' }, { status: 400 });
}

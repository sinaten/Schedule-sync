import { randomUUID } from 'crypto';
import { db } from '../../../../lib/db';
import { currentUser, isAdmin } from '../../../../lib/user';
import { cleanProject, cleanSite, cleanSiteFull } from '../../../../lib/projmeta';
export const dynamic = 'force-dynamic';

const no = () => Response.json({ error: 'Admins only' }, { status: 403 });
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'site';

// Admins only.
// GET = every site ({ sites: { id: site } }) and every project's own settings ({ meta: { job: project } }).
//   Projects saved before sites existed (country / city / site name typed on the project) are moved into sites the first time this runs.
// PUT { site: { id?, name, country, city, address, lat, lng, contacts, places, wf } } saves a site (a new id is made when there is none).
// PUT { job, meta } saves one project (meta.siteId = the site it is in).
// DELETE ?site=id removes a site that has no projects.
export async function GET() {
  if (!isAdmin(await currentUser())) return no();
  const sql = await db();
  const r = await sql`select key, value from settings where starts_with(key, 'projmeta:') or starts_with(key, 'sitemeta:') or starts_with(key, 'site:')`;
  const meta = {}, sites = {}, old = {};
  for (const x of r) {
    if (x.key.startsWith('projmeta:')) meta[x.key.slice(9)] = cleanProject(x.value);
    else if (x.key.startsWith('sitemeta:')) old[x.key.slice(9)] = cleanSite(x.value);
    else sites[x.key.slice(5)] = { id: x.key.slice(5), ...cleanSiteFull(x.value) };
  }
  // one-time move of the old country / city / site fields into real sites
  const touched = new Set(), newSites = new Set();
  for (const [job, m] of Object.entries(meta)) {
    if (m.siteId && sites[m.siteId]) continue;
    if (!(m.country || m.city || m.site || m.address || m.lat !== null)) continue;
    const name = m.site || m.city || m.country || 'Site';
    const id = 's-' + slug([m.country, m.city, name].join(' '));
    if (!sites[id]) {
      const k = m.country && m.city && m.site ? [m.country, m.city, m.site].join('>') : '';
      sites[id] = { id, ...cleanSiteFull({ name, country: m.country, city: m.city, address: m.address, lat: m.lat, lng: m.lng, ...(old[k] || {}) }) };
      newSites.add(id);
    } else if (newSites.has(id)) {
      const s = sites[id];
      if (!s.address && m.address) s.address = m.address;
      if (s.lat === null && m.lat !== null) { s.lat = m.lat; s.lng = m.lng; }
    }
    m.siteId = id; touched.add(job);
  }
  for (const id of newSites) await sql`insert into settings(key, value) values(${'site:' + id}, ${JSON.stringify(sites[id])}::jsonb) on conflict (key) do update set value = excluded.value`;
  for (const job of touched) await sql`insert into settings(key, value) values(${'projmeta:' + job}, ${JSON.stringify(meta[job])}::jsonb) on conflict (key) do update set value = excluded.value`;
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
    const d = cleanSiteFull(b.site);
    if (!d.name) return Response.json({ error: 'A site needs a name' }, { status: 400 });
    let id = String(b.site.id || '').trim();
    if (id && !/^[\w-]{1,80}$/.test(id)) return Response.json({ error: 'Bad site id' }, { status: 400 });
    if (!id) id = 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const [cur] = await sql`select value from settings where key = ${'site:' + id}`;
    d.guide = (cur && cur.value && cur.value.guide) || ''; // the share link is only changed with { guide }, never by a normal save
    await sql`insert into settings(key, value) values(${'site:' + id}, ${JSON.stringify(d)}::jsonb) on conflict (key) do update set value = excluded.value`;
    return Response.json({ ok: true, id });
  }
  if (b.guide) {
    // { guide: { site, on } } turns the public read-only guide link of a site on (new secret link) or off
    const id = String(b.guide.site || '');
    if (!/^[\w-]{1,80}$/.test(id)) return Response.json({ error: 'No site' }, { status: 400 });
    const [cur] = await sql`select value from settings where key = ${'site:' + id}`;
    if (!cur) return Response.json({ error: 'Site not found' }, { status: 404 });
    const v = { ...cleanSiteFull(cur.value), guide: b.guide.on ? randomUUID().replace(/-/g, '') : '' };
    await sql`update settings set value = ${JSON.stringify(v)}::jsonb where key = ${'site:' + id}`;
    return Response.json({ ok: true, guide: v.guide });
  }
  return Response.json({ error: 'job, site or guide is required' }, { status: 400 });
}

export async function DELETE(req) {
  if (!isAdmin(await currentUser())) return no();
  const id = new URL(req.url).searchParams.get('site') || '';
  if (!/^[\w-]{1,80}$/.test(id)) return Response.json({ error: 'No site' }, { status: 400 });
  const sql = await db();
  const used = await sql`select 1 from settings where starts_with(key, 'projmeta:') and value->>'siteId' = ${id} limit 1`;
  if (used.length) return Response.json({ error: 'This site still has projects. Move them first.' }, { status: 400 });
  await sql`delete from settings where key = ${'site:' + id}`;
  return Response.json({ ok: true });
}

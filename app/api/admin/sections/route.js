import { db } from '../../../../lib/db';
import { currentUser, isAdmin } from '../../../../lib/user';
import { visitsDb } from '../../../../lib/visits';
export const dynamic = 'force-dynamic';

const no = () => Response.json({ error: 'Admins only' }, { status: 403 });
async function sections() {
  const sql = await db();
  await sql`create table if not exists sections(id text primary key, job text not null, name text not null, pos int default 0, created_at timestamptz default now())`;
  return sql;
}

// Admin API for project sections (each section gets its own QR code).
export async function GET() {
  if (!isAdmin(await currentUser())) return no();
  const sql = await sections();
  await visitsDb();
  const rows = await sql`select s.id, s.job, s.name, s.pos, s.lat, s.lng, (select count(*)::int from media m join visits v on v.id = m.visit_id where v.section_id = s.id) as files from sections s order by s.job, s.pos, s.created_at`;
  const j = await sql`select distinct job from schedules where job is not null union select substr(key, 7) from settings where key like 'model:%' union select job from sections order by 1`;
  return Response.json({ sections: rows, jobs: j.map((x) => x.job).filter(Boolean) });
}

export async function POST(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || '').trim().slice(0, 80);
  const names = (Array.isArray(b.names) ? b.names : [b.name]).map((x) => String(x || '').trim().slice(0, 120)).filter(Boolean).slice(0, 100);
  if (!job || !names.length) return Response.json({ error: 'Job and section name are required' }, { status: 400 });
  const sql = await sections();
  const [m] = await sql`select coalesce(max(pos), 0) as m from sections where job = ${job}`;
  let pos = Number(m.m);
  for (const name of names) {
    pos += 1;
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    await sql`insert into sections(id, job, name, pos) values(${id}, ${job}, ${name}, ${pos})`;
  }
  return Response.json({ ok: true });
}

// Reads "40.0123, -83.0456", a Google Maps link (@lat,lng) or { lat, lng }.
function parseLoc(x) {
  let lat, lng;
  if (x && typeof x === 'object') { lat = Number(x.lat); lng = Number(x.lng); }
  else {
    const s = String(x);
    const m = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(s) || /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(s) || /(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/.exec(s);
    if (!m) return null;
    lat = Number(m[1]); lng = Number(m[2]);
  }
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return null;
  return { lat, lng };
}

export async function PUT(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  if ('location' in b) {
    const sid = String(b.id || '');
    if (!sid) return Response.json({ error: 'Section is required' }, { status: 400 });
    const q = await sections();
    await visitsDb();
    if (b.location === null || b.location === '') {
      await q`update sections set lat = null, lng = null where id = ${sid}`;
      return Response.json({ ok: true });
    }
    const p = parseLoc(b.location);
    if (!p) return Response.json({ error: 'Could not read the coordinates. Paste them like 40.0123, -83.0456' }, { status: 400 });
    await q`update sections set lat = ${p.lat}, lng = ${p.lng} where id = ${sid}`;
    return Response.json({ ok: true });
  }
  const id = String(b.id || '');
  const name = String(b.name || '').trim().slice(0, 120);
  if (!id || !name) return Response.json({ error: 'Name is required' }, { status: 400 });
  const sql = await sections();
  await sql`update sections set name = ${name} where id = ${id}`;
  return Response.json({ ok: true });
}

export async function DELETE(req) {
  if (!isAdmin(await currentUser())) return no();
  const id = new URL(req.url).searchParams.get('id') || '';
  const sql = await sections();
  await sql`delete from sections where id = ${id}`;
  return Response.json({ ok: true });
}

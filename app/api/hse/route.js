import { currentUser, canJob, canEdit } from '../../../lib/user';
import { db } from '../../../lib/db';
export const dynamic = 'force-dynamic';
const nm = (u) => (u && u.name) || 'admin';
let ready;
async function hdb() {
  const sql = await db();
  if (!ready) ready = (async () => {
    await sql`create table if not exists hse_profile(job text primary key, data jsonb not null default '{}'::jsonb, updated_at timestamptz default now(), updated_by text)`;
    await sql`create table if not exists hse_people(job text not null, name text not null, steps jsonb not null default '{}'::jsonb, appt text, expiry text, created_at timestamptz default now(), updated_at timestamptz default now(), primary key(job, name))`;
  })();
  await ready;
  return sql;
}
const FIELDS = ['hospital', 'hospital_phone', 'hospital_address', 'hse_name', 'hse_phone', 'hse_email', 'gc_name', 'gc_phone', 'orient_name', 'orient_phone', 'orient_email', 'orient_place', 'muster', 'first_aid'];
export async function GET(req) {
  const job = new URL(req.url).searchParams.get('job') || '';
  const u = await currentUser();
  if (!u || !job || !canJob(u, job)) return Response.json({ error: 'No access' }, { status: 403 });
  const sql = await hdb();
  const [p] = await sql`select data, updated_by, updated_at from hse_profile where job = ${job}`;
  const people = await sql`select name, steps, appt, expiry, updated_at from hse_people where job = ${job} order by created_at`;
  return Response.json({ me: nm(u), can: canEdit(u), profile: p ? p.data : {}, people });
}
export async function POST(req) {
  const b = await req.json().catch(() => ({}));
  const job = String(b.job || '');
  const u = await currentUser();
  if (!u || !job || !canJob(u, job)) return Response.json({ error: 'No access' }, { status: 403 });
  if (!canEdit(u)) return Response.json({ error: 'Only a manager or an editor can do this' }, { status: 403 });
  const sql = await hdb();
  if (b.action === 'profile') {
    const [cur] = await sql`select data from hse_profile where job = ${job}`;
    const d = { ...(cur ? cur.data : {}) };
    FIELDS.forEach((k) => { if (typeof (b.data || {})[k] === 'string') d[k] = b.data[k].trim().slice(0, 200); });
    await sql`insert into hse_profile(job, data, updated_by) values(${job}, ${JSON.stringify(d)}::jsonb, ${nm(u)}) on conflict (job) do update set data = excluded.data, updated_at = now(), updated_by = excluded.updated_by`;
    return Response.json({ ok: true });
  }
  const name = String(b.name || '').trim().slice(0, 80);
  if (!name) return Response.json({ error: 'Name needed' }, { status: 400 });
  if (b.action === 'person-add') {
    await sql`insert into hse_people(job, name) values(${job}, ${name}) on conflict do nothing`;
    return Response.json({ ok: true });
  }
  if (b.action === 'person-del') {
    await sql`delete from hse_people where job = ${job} and name = ${name}`;
    return Response.json({ ok: true });
  }
  if (b.action === 'step') {
    const n = Number(b.step);
    if (!(n >= 1 && n <= 5)) return Response.json({ error: 'Bad step' }, { status: 400 });
    const [r] = await sql`select steps, appt, expiry from hse_people where job = ${job} and name = ${name}`;
    if (!r) return Response.json({ error: 'No such person' }, { status: 404 });
    const st = { ...r.steps };
    let appt = r.appt, expiry = r.expiry;
    if (typeof b.appt === 'string') appt = b.appt.trim().slice(0, 200);
    if (typeof b.expiry === 'string') expiry = b.expiry.trim().slice(0, 40);
    if (b.done === true) {
      if (n > 1 && !st[String(n - 1)]) return Response.json({ error: 'Finish the step before first' }, { status: 400 });
      st[String(n)] = { by: nm(u), at: new Date().toISOString() };
    } else if (b.done === false) {
      for (let k = n; k <= 5; k++) delete st[String(k)]; // undoing a step undoes the ones after it
    }
    await sql`update hse_people set steps = ${JSON.stringify(st)}::jsonb, appt = ${appt}, expiry = ${expiry}, updated_at = now() where job = ${job} and name = ${name}`;
    return Response.json({ ok: true });
  }
  return Response.json({ error: 'Unknown action' }, { status: 400 });
}

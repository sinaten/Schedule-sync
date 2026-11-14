import { db } from '../../../lib/db';
import { authOn, makeToken, hashPw, safeEq } from '../../../lib/auth';
export const dynamic = 'force-dynamic';

// Too many wrong tries (by this address or for this username) in 15 minutes: locked for the rest of the window.
const MAX_FAILS = 8;
const WINDOW = '15 minutes';

export async function POST(req) {
  if (!authOn()) return Response.json({ error: 'Logins are not set up yet (ADMIN_USER / ADMIN_PASSWORD in Vercel)' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.username || '').trim().slice(0, 60);
  const password = String(body.password || '').slice(0, 200);
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64) || 'unknown';
  const sql = await db();
  await sql`create table if not exists login_fails(id serial primary key, ip text, name text, at timestamptz default now())`;
  const [c] = await sql`select count(*)::int as n from login_fails where at > now() - ${WINDOW}::interval and (ip = ${ip} or (${name} <> '' and name = ${name}))`;
  if (c.n >= MAX_FAILS) return Response.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429, headers: { 'retry-after': '900' } });
  let ok = false;
  if (name && name === process.env.ADMIN_USER) {
    ok = safeEq(password, process.env.ADMIN_PASSWORD);
  } else if (name) {
    const [u] = await sql`select pass_hash, salt from users where username = ${name}`;
    if (u) ok = safeEq(await hashPw(password, u.salt), u.pass_hash);
  }
  if (!ok) {
    await sql`insert into login_fails(ip, name) values(${ip}, ${name})`;
    await sql`delete from login_fails where at < now() - interval '1 day'`;
    await new Promise((r) => setTimeout(r, 800));
    return Response.json({ error: 'Wrong username or password' }, { status: 401 });
  }
  await sql`delete from login_fails where ip = ${ip} or name = ${name}`;
  const token = await makeToken(name, 24 * 30);
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json',
      'set-cookie': 'ss=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + 30 * 86400,
    },
  });
}

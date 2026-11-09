import { db } from '../../../lib/db';
import { authOn, makeToken, hashPw, safeEq } from '../../../lib/auth';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!authOn()) return Response.json({ error: 'Logins are not set up yet (ADMIN_USER / ADMIN_PASSWORD in Vercel)' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.username || '').trim().slice(0, 60);
  const password = String(body.password || '').slice(0, 200);
  let ok = false;
  if (name && name === process.env.ADMIN_USER) {
    ok = safeEq(password, process.env.ADMIN_PASSWORD);
  } else if (name) {
    const sql = await db();
    const [u] = await sql`select pass_hash, salt from users where username = ${name}`;
    if (u) ok = safeEq(await hashPw(password, u.salt), u.pass_hash);
  }
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800));
    return Response.json({ error: 'Wrong username or password' }, { status: 401 });
  }
  const token = await makeToken(name, 24 * 30);
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'content-type': 'application/json',
      'set-cookie': 'ss=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + 30 * 86400,
    },
  });
}

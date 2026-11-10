import { currentUser, isAdmin } from '../../../../lib/user';
import { db } from '../../../../lib/db';
import { getQrConfig } from '../../../../lib/qrcfg';
export const dynamic = 'force-dynamic';

const no = () => Response.json({ error: 'Admins only' }, { status: 403 });

// Admin settings for QR codes: Revit parameter names and print size.
export async function GET() {
  if (!isAdmin(await currentUser())) return no();
  return Response.json(await getQrConfig());
}

export async function PUT(req) {
  if (!isAdmin(await currentUser())) return no();
  const b = await req.json().catch(() => ({}));
  const nameParam = String(b.nameParam || '').trim().slice(0, 80);
  const codeParam = String(b.codeParam || '').trim().slice(0, 80);
  const sizeCm = Number(b.sizeCm);
  if (!nameParam || !codeParam) return Response.json({ error: 'Both parameter names are required' }, { status: 400 });
  if (nameParam.toLowerCase() === codeParam.toLowerCase()) return Response.json({ error: 'The two names must be different' }, { status: 400 });
  if (!(sizeCm >= 2 && sizeCm <= 18)) return Response.json({ error: 'Size must be between 2 and 18 cm' }, { status: 400 });
  const sql = await db();
  const value = JSON.stringify({ nameParam, codeParam, sizeCm });
  await sql`insert into settings(key, value) values('qr_config', ${value}::jsonb) on conflict (key) do update set value = excluded.value`;
  return Response.json({ ok: true });
}

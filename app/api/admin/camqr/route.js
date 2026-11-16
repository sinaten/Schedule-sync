import { db } from '../../../../lib/db';
import { currentUser, isAdmin } from '../../../../lib/user';
export const dynamic = 'force-dynamic';

// Admin: every saved camera view that has a QR code, across all jobs.
export async function GET() {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const sql = await db();
  const rows = await sql`select key, value from settings where key like 'camviews:%'`;
  const out = [];
  for (const r of rows) {
    const job = r.key.slice('camviews:'.length);
    for (const v of Array.isArray(r.value) ? r.value : []) if (v.qr) out.push({ job, id: v.id, n: v.n || 0, name: v.name, qr: v.qr, qrName: v.qrName || v.name });
  }
  out.sort((a, b) => a.job.localeCompare(b.job) || a.n - b.n);
  return Response.json({ items: out });
}

import { put } from '@vercel/blob';
import { currentUser, isAdmin } from '../../../../lib/user';
export const dynamic = 'force-dynamic';
const MAX = 4 * 1024 * 1024; // the website host accepts about 4.5 MB per request

// Admins only: attach a form or a rules file (PDF, picture, document) to a site's orientation card.
export async function POST(req) {
  if (!isAdmin(await currentUser())) return Response.json({ error: 'Admins only' }, { status: 403 });
  const f = await req.formData().catch(() => null);
  const file = f && f.get('file');
  const site = String((f && f.get('site')) || '');
  if (!/^[\w-]{1,80}$/.test(site)) return Response.json({ error: 'No site' }, { status: 400 });
  if (!file || typeof file === 'string' || !file.size) return Response.json({ error: 'No file' }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: 'The file is too big (4 MB at most)' }, { status: 413 });
  const safe = String(file.name || 'file').replace(/[^\w.-]+/g, '_').slice(-80);
  const r = await put('sitefiles/' + site + '/' + Date.now() + '-' + safe, file, { access: 'private', addRandomSuffix: true, contentType: file.type || undefined });
  return Response.json({ ok: true, name: String(file.name || safe).slice(0, 120), path: r.pathname });
}

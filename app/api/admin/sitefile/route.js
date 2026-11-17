import { serveBlob } from '../../../../lib/blobserve';
import { currentUser, isAdmin } from '../../../../lib/user';
export const dynamic = 'force-dynamic';

// Admins only: open a file attached to a site (the same file workers get through the public guide link).
export async function GET(req) {
  if (!isAdmin(await currentUser())) return new Response('Admins only', { status: 403 });
  const p = new URL(req.url).searchParams.get('p') || '';
  if (!p.startsWith('sitefiles/') || p.includes('..')) return new Response('Not found', { status: 404 });
  return serveBlob(req, p);
}

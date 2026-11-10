import { NextResponse } from 'next/server';
import { authOn, readToken } from './lib/auth';

// Site gate.
// - Once ADMIN_USER and ADMIN_PASSWORD are set in Vercel: everything needs a login (cookie), except the login page and the Revit add-in (/api/addin/*, which uses its API key).
// - Until then: the old behaviour (anyone can read, changes need SITE_PASSWORD) so nobody is locked out.
export async function middleware(req) {
  const path = req.nextUrl.pathname;
  if (path.startsWith('/api/addin')) return;
  if (!authOn()) {
    if (req.method === 'GET' || req.method === 'HEAD') return;
    const h = req.headers.get('authorization') || '';
    const d = atob(h.split(' ')[1] || '');
    if (process.env.SITE_PASSWORD && d.slice(d.indexOf(':') + 1) === process.env.SITE_PASSWORD) return;
    return new Response('Password required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Schedule Sync"' } });
  }
  if (path === '/login' || path === '/api/login' || path === '/api/logout' || path === '/robots.txt' ||
    path === '/manifest.webmanifest' || path === '/sw.js' || path.startsWith('/icons/') || path.startsWith('/qr/') || path.startsWith('/share/')) return;
  const session = await readToken(req.cookies.get('ss')?.value);
  if (session) return;
  if (path.startsWith('/api/')) return Response.json({ error: 'Login required' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '?next=' + encodeURIComponent(path + req.nextUrl.search);
  return NextResponse.redirect(url);
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };

// Password gate for the website and its UI API. The Revit add-in uses /api/addin/* with an API key instead.
export function middleware(req) {
  if (req.nextUrl.pathname.startsWith('/api/addin') || req.method === 'GET' || req.method === 'HEAD') return;
  const h = req.headers.get('authorization') || '';
  const d = atob(h.split(' ')[1] || '');
  if (process.env.SITE_PASSWORD && d.slice(d.indexOf(':') + 1) === process.env.SITE_PASSWORD) return;
  return new Response('Password required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Schedule Sync"' } });
}
export const config = { matcher: ['/((?!_next/static|favicon.ico).*)'] };

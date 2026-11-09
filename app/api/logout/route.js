export const dynamic = 'force-dynamic';
// Signs the user out by clearing the cookie, then goes to the login page.
export async function GET(req) {
  return new Response(null, {
    status: 302,
    headers: { location: new URL('/login', req.url).toString(), 'set-cookie': 'ss=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' },
  });
}

// Login helpers. Web Crypto only, so this also runs in the edge middleware.
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const secret = () => (process.env.SESSION_SECRET || '') + '|' + (process.env.ADMIN_PASSWORD || '') + '|' + (process.env.API_KEY || '');

// Logins are active only once ADMIN_USER and ADMIN_PASSWORD are set in Vercel. Until then the old site password keeps working.
export const authOn = () => !!process.env.ADMIN_USER && !!process.env.ADMIN_PASSWORD;

export function safeEq(a, b) {
  a = String(a ?? ''); b = String(b ?? '');
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

async function hmac(msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}

export async function makeToken(u, hours = 24 * 7) {
  const body = btoa(encodeURIComponent(JSON.stringify({ u, exp: Date.now() + hours * 3600000 })));
  return body + '.' + (await hmac(body));
}

export async function readToken(t) {
  if (!t) return null;
  const [body, sig] = String(t).split('.');
  if (!body || !sig || !safeEq(sig, await hmac(body))) return null;
  try {
    const p = JSON.parse(decodeURIComponent(atob(body)));
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));

export async function hashPw(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(String(pw)), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, k, 256));
}

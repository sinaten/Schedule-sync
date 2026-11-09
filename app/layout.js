import './globals.css';
import { currentUser, isAdmin } from '../lib/user';
export const metadata = { title: 'Schedule Sync', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function Layout({ children }) {
  const u = await currentUser();
  const bar = { display: 'flex', gap: 16, alignItems: 'center', padding: '10px 16px', background: '#16262e', color: '#fff', fontSize: 15, flexWrap: 'wrap' };
  const link = { color: '#fff', textDecoration: 'none', fontWeight: 600 };
  return (
    <html lang="en">
      <body>
        {u && !u.legacy && (
          <nav style={bar}>
            <a href="/" style={link}>Jobs</a>
            {isAdmin(u) && <a href="/admin" style={link}>Admin</a>}
            <span style={{ marginLeft: 'auto', opacity: 0.8 }}>{u.name} · {u.role}</span>
            <a href="/api/logout" style={link}>Sign out</a>
          </nav>
        )}
        {children}
      </body>
    </html>
  );
}

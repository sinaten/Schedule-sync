import './globals.css';
import { currentUser, isAdmin } from '../lib/user';
export const metadata = {
  title: 'Schedule Sync',
  robots: { index: false, follow: false },
  icons: { icon: '/icons/192', apple: '/icons/180' },
  appleWebApp: { capable: true, title: 'Schedule Sync', statusBarStyle: 'black-translucent' },
};
export const viewport = { themeColor: '#16262e', width: 'device-width', initialScale: 1 };
const REGISTER_SW = "if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));";
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
        <script dangerouslySetInnerHTML={{ __html: REGISTER_SW }} />
      </body>
    </html>
  );
}

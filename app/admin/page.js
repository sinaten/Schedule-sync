import { notFound } from 'next/navigation';
import { currentUser, isAdmin } from '../../lib/user';
import AdminTabs from './AdminTabs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export default async function Admin() {
  const u = await currentUser();
  if (u && u.legacy) {
    return <main><h1>Admin</h1><p>Logins are not set up yet. Add ADMIN_USER and ADMIN_PASSWORD in Vercel (Settings, Environment Variables) and redeploy.</p></main>;
  }
  if (!isAdmin(u)) notFound();
  return (
    <main className="wide">
      <h1>Admin</h1>
      <AdminTabs />
    </main>
  );
}

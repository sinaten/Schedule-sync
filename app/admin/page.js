import { notFound } from 'next/navigation';
import { currentUser, isAdmin } from '../../lib/user';
import { visitsDb } from '../../lib/visits';
import Folders from '../Folders';
import AdminTabs from './AdminTabs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// "Photos & videos" tab: pick a project, optionally one section, and see / share / delete its folders.
async function MediaPanel({ job, section, visit }) {
  const sql = await visitsDb();
  const jr = await sql`select job from sections union select job from visits order by 1`;
  const jobs = jr.map((x) => x.job).filter(Boolean);
  const cur = jobs.includes(job) ? job : jobs[0] || '';
  const pill = (active) => ({ padding: '6px 12px', fontSize: 14, borderRadius: 16, border: '1px solid #cfd8dc', background: active ? '#16262e' : '#fff', color: active ? '#fff' : '#16262e', textDecoration: 'none' });
  if (!jobs.length) return <p className="muted">No projects yet.</p>;
  return (
    <>
      <p className="muted" style={{ margin: '0 0 6px' }}>Project</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {jobs.map((j) => <a key={j} href={'/admin?tab=media&job=' + encodeURIComponent(j)} style={pill(j === cur)}>{j}</a>)}
      </div>
      <Folders job={cur} section={section} visit={visit} base="/admin?tab=media" />
    </>
  );
}

export default async function Admin({ searchParams }) {
  const u = await currentUser();
  if (u && u.legacy) {
    return <main><h1>Admin</h1><p>Logins are not set up yet. Add ADMIN_USER and ADMIN_PASSWORD in Vercel (Settings, Environment Variables) and redeploy.</p></main>;
  }
  if (!isAdmin(u)) notFound();
  const tab = String(searchParams.tab || '');
  return (
    <main className="wide">
      <h1>Admin</h1>
      <AdminTabs initialTab={tab} media={<MediaPanel job={String(searchParams.job || '')} section={String(searchParams.section || '')} visit={String(searchParams.visit || '')} />} />
    </main>
  );
}

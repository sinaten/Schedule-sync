import { notFound } from 'next/navigation';
import { currentUser, isAdmin } from '../../lib/user';
import { visitsDb } from '../../lib/visits';
import MediaGrid from '../MediaGrid';
import AdminTabs from './AdminTabs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// "Photos & videos" tab: pick a project, optionally one section, and see / share / delete its folders.
async function MediaPanel({ job, section }) {
  const sql = await visitsDb();
  const jr = await sql`select job from sections union select job from visits order by 1`;
  const jobs = jr.map((x) => x.job).filter(Boolean);
  const cur = jobs.includes(job) ? job : jobs[0] || '';
  const secs = cur ? await sql`select s.id, s.name, (select count(*)::int from media m join visits v on v.id = m.visit_id where v.section_id = s.id) as files from sections s where s.job = ${cur} order by s.pos, s.created_at` : [];
  const pill = (active) => ({ padding: '6px 12px', fontSize: 14, borderRadius: 16, border: '1px solid #cfd8dc', background: active ? '#16262e' : '#fff', color: active ? '#fff' : '#16262e', textDecoration: 'none' });
  if (!jobs.length) return <p className="muted">No projects yet.</p>;
  return (
    <>
      <p className="muted" style={{ margin: '0 0 6px' }}>Project</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {jobs.map((j) => <a key={j} href={'/admin?tab=media&job=' + encodeURIComponent(j)} style={pill(j === cur)}>{j}</a>)}
      </div>
      <p className="muted" style={{ margin: '0 0 6px' }}>Section</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <a href={'/admin?tab=media&job=' + encodeURIComponent(cur)} style={pill(!section)}>All</a>
        {secs.map((s) => <a key={s.id} href={'/admin?tab=media&job=' + encodeURIComponent(cur) + '&section=' + encodeURIComponent(s.id)} style={pill(section === s.id)}>{s.name}{s.files ? ' (' + s.files + ')' : ''}</a>)}
      </div>
      <MediaGrid job={cur} section={section || undefined} />
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
      <AdminTabs initialTab={tab} media={<MediaPanel job={String(searchParams.job || '')} section={String(searchParams.section || '')} />} />
    </main>
  );
}

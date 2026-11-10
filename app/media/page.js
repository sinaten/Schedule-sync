import { notFound } from 'next/navigation';
import { currentUser, canJob, canEdit } from '../../lib/user';
import { visitsDb } from '../../lib/visits';
import Folders from '../Folders';
import { getRules, limitFor } from '../../lib/mediarules';
export const dynamic = 'force-dynamic';

// /media : gallery. Projects -> section folders -> visit folders -> photos / videos.
export default async function Media({ searchParams }) {
  const u = await currentUser();
  const job = String(searchParams.job || '');
  if (job) {
    if (!canJob(u, job)) notFound();
    return (
      <main>
        <p><a href="/media">&larr; All projects</a></p>
        <h1>Photos &amp; videos</h1>
        <Folders job={job} section={String(searchParams.section || '')} visit={String(searchParams.visit || '')} base="/media" />
      </main>
    );
  }
  const sql = await visitsDb();
  const edit = canEdit(u);
  const me = (u && u.name) || null;
  const vm = limitFor(u, await getRules(), 'view');
  const rows = await sql`select j.job, (select count(*)::int from media m join visits v on v.id = m.visit_id where v.job = j.job and (${edit}::boolean or (v.username = ${me} and m.kind <> 'scan') and (${vm}::int is null or m.created_at > now() - make_interval(mins => ${vm}::int))) as files from (select job from sections union select job from visits) j order by j.job`;
  const jobs = rows.filter((r) => canJob(u, r.job) && (edit || r.files > 0));
  return (
    <main>
      <h1>Photos &amp; videos</h1>
      {!jobs.length && <p className="muted">No projects yet.</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
        {jobs.map((r) => (
          <a key={r.job} href={'/media?job=' + encodeURIComponent(r.job)} style={{ width: 140, textDecoration: 'none', color: 'inherit', textAlign: 'center', display: 'block' }}>
            <svg width="72" height="58" viewBox="0 0 64 52" aria-hidden="true"><path d="M2 8a4 4 0 0 1 4-4h16l6 6h30a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" fill="#F2B63A" /></svg>
            <div style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{r.job}</div>
            <div className="muted" style={{ fontSize: 12 }}>{r.files} {r.files === 1 ? 'file' : 'files'}</div>
          </a>
        ))}
      </div>
    </main>
  );
}

import { currentUser, canJob } from '../../lib/user';
import { visitsDb } from '../../lib/visits';
export const dynamic = 'force-dynamic';

const fileUrl = (p) => '/api/media/file?p=' + encodeURIComponent(p);
const mb = (n) => (Number(n) / 1048576).toFixed(1) + ' MB';

// Photos and videos saved from the capture screen, newest visit first. Each user only sees the jobs they may access.
export default async function Media() {
  const u = await currentUser();
  const sql = await visitsDb();
  const all = await sql`select id, job, section_name, username, lat, lng, created_at from visits order by created_at desc limit 100`;
  const visits = all.filter((v) => canJob(u, v.job));
  const ids = visits.map((v) => v.id);
  const media = ids.length ? await sql`select visit_id, pathname, kind, size from media where visit_id = any(${ids}) order by created_at` : [];
  const by = {};
  for (const m of media) (by[m.visit_id] ||= []).push(m);
  const shown = visits.filter((v) => (by[v.id] || []).length);
  return (
    <main>
      <h1>Photos &amp; videos</h1>
      {!shown.length && <p className="muted">Nothing saved yet.</p>}
      {shown.map((v) => (
        <section key={v.id} style={{ marginBottom: 24 }}>
          <p style={{ margin: '0 0 6px' }}>
            <b>{v.job}</b> &middot; {v.section_name} &middot; {new Date(v.created_at).toISOString().replace('T', ' ').slice(0, 16)} UTC
            {v.username ? ' · ' + v.username : ''}
            {v.lat != null && v.lng != null && (
              <> &middot; <a href={'https://maps.google.com/?q=' + v.lat + ',' + v.lng} target="_blank" rel="noreferrer">map</a></>
            )}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {by[v.id].map((m) =>
              m.kind === 'photo' ? (
                <a key={m.pathname} href={fileUrl(m.pathname)} target="_blank" rel="noreferrer">
                  <img src={fileUrl(m.pathname)} alt="" loading="lazy" style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 8, background: '#eee' }} />
                </a>
              ) : (
                <a key={m.pathname} href={fileUrl(m.pathname)} target="_blank" rel="noreferrer"
                  style={{ width: 110, height: 110, borderRadius: 8, background: '#16262e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontSize: 13, textDecoration: 'none' }}>
                  <span>Video</span><span style={{ opacity: 0.7 }}>{mb(m.size)}</span>
                </a>
              )
            )}
          </div>
        </section>
      ))}
    </main>
  );
}

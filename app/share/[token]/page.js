import { notFound } from 'next/navigation';
import { visitsDb } from '../../../lib/visits';
export const dynamic = 'force-dynamic';

const mb = (n) => (Number(n) / 1048576).toFixed(1) + ' MB';
const when = (d) => new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

// Public page for a shared section: anyone with the link can view (no login).
export default async function Share({ params }) {
  const sql = await visitsDb();
  const [s] = await sql`select id, job, name from sections where share = ${String(params.token || '')}`;
  if (!s) notFound();
  const visits = await sql`select id, username, created_at from visits where section_id = ${s.id} order by created_at desc`;
  const ids = visits.map((v) => v.id);
  const media = ids.length ? await sql`select visit_id, pathname, kind, size from media where visit_id = any(${ids}) order by created_at` : [];
  const by = {};
  for (const m of media) (by[m.visit_id] ||= []).push(m);
  const url = (p) => '/share/' + params.token + '/f?p=' + encodeURIComponent(p);
  const shown = visits.filter((v) => (by[v.id] || []).length);
  return (
    <main>
      <p className="muted" style={{ margin: 0 }}>{s.job}</p>
      <h1 style={{ marginTop: 0 }}>{s.name}</h1>
      {!shown.length && <p className="muted">No photos or videos yet.</p>}
      {shown.map((v) => (
        <div key={v.id} style={{ marginBottom: 14 }}>
          <p className="muted" style={{ margin: '0 0 6px', fontSize: 13 }}>{when(v.created_at)}{v.username ? ' · ' + v.username : ''}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {by[v.id].map((m) =>
              m.kind === 'photo' ? (
                <a key={m.pathname} href={url(m.pathname)} target="_blank" rel="noreferrer">
                  <img src={url(m.pathname)} alt="" loading="lazy" style={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 8, background: '#eee' }} />
                </a>
              ) : (
                <a key={m.pathname} href={url(m.pathname)} target="_blank" rel="noreferrer"
                  style={{ width: 120, height: 120, borderRadius: 8, background: '#16262e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontSize: 13, textDecoration: 'none' }}>
                  <span>Video</span><span style={{ opacity: 0.7 }}>{mb(m.size)}</span>
                </a>
              )
            )}
          </div>
        </div>
      ))}
    </main>
  );
}

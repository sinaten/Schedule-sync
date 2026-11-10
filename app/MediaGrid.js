import { visitsDb } from '../lib/visits';
import ShareButton from './ShareButton';

const fileUrl = (p) => '/api/media/file?p=' + encodeURIComponent(p);
const mb = (n) => (Number(n) / 1048576).toFixed(1) + ' MB';
const when = (d) => new Date(d).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

// Photos and videos of one job, grouped by section (newest visit first). The caller must already have checked access to the job.
export default async function MediaGrid({ job }) {
  const sql = await visitsDb();
  const visits = await sql`select id, section_id, section_name, username, lat, lng, created_at from visits where job = ${job} order by created_at desc limit 200`;
  const ids = visits.map((v) => v.id);
  const media = ids.length ? await sql`select visit_id, pathname, kind, size from media where visit_id = any(${ids}) order by created_at` : [];
  const by = {};
  for (const m of media) (by[m.visit_id] ||= []).push(m);
  const groups = {};
  for (const v of visits) if ((by[v.id] || []).length) (groups[v.section_name || 'unassigned'] ||= []).push(v);
  const names = Object.keys(groups).sort((a, b) => (a === 'unassigned') - (b === 'unassigned') || a.localeCompare(b));
  if (!names.length) return <p className="muted">No photos or videos yet.</p>;
  return (
    <div>
      {names.map((n) => {
        const files = groups[n].flatMap((v) => by[v.id]);
        const photos = files.filter((f) => f.kind === 'photo').length;
        const videos = files.length - photos;
        return (
          <section key={n} style={{ marginBottom: 22 }}>
            <h3 style={{ margin: '0 0 4px' }}>{n}</h3>
            <p className="muted" style={{ margin: '0 0 8px' }}>{photos} photo{photos === 1 ? '' : 's'}{videos ? ', ' + videos + ' video' + (videos === 1 ? '' : 's') : ''}</p>
            {groups[n][0].section_id && <ShareButton sectionId={groups[n][0].section_id} />}
            {groups[n].map((v) => (
              <div key={v.id} style={{ marginBottom: 12 }}>
                <p className="muted" style={{ margin: '0 0 6px', fontSize: 13 }}>
                  {when(v.created_at)}{v.username ? ' · ' + v.username : ''}
                  {v.lat != null && v.lng != null && (<> &middot; <a href={'https://maps.google.com/?q=' + v.lat + ',' + v.lng} target="_blank" rel="noreferrer">map</a></>)}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {by[v.id].map((m) =>
                    m.kind === 'photo' ? (
                      <a key={m.pathname} href={fileUrl(m.pathname)} target="_blank" rel="noreferrer">
                        <img src={fileUrl(m.pathname)} alt="" loading="lazy" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, background: '#eee' }} />
                      </a>
                    ) : (
                      <a key={m.pathname} href={fileUrl(m.pathname)} target="_blank" rel="noreferrer"
                        style={{ width: 100, height: 100, borderRadius: 8, background: '#16262e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', fontSize: 13, textDecoration: 'none' }}>
                        <span>Video</span><span style={{ opacity: 0.7 }}>{mb(m.size)}</span>
                      </a>
                    )
                  )}
                </div>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

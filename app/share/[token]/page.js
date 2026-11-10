import { notFound } from 'next/navigation';
import { visitsDb } from '../../../lib/visits';
import MediaItem from '../../MediaItem';
import LocalTime from '../../LocalTime';
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
  const media = ids.length ? await sql`select visit_id, pathname, kind, size from media where visit_id = any(${ids}) and kind <> 'scan' order by created_at` : [];
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
          <p className="muted" style={{ margin: '0 0 6px', fontSize: 13 }}><LocalTime iso={new Date(v.created_at).toISOString()} />{v.username ? ' · ' + v.username : ''}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {by[v.id].map((m) => <MediaItem key={m.pathname} url={url(m.pathname)} kind={m.kind} label={mb(m.size)} size={120} />)}
          </div>
        </div>
      ))}
    </main>
  );
}

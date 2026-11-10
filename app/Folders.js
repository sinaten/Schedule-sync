import { visitsDb, canManage } from '../lib/visits';
import { currentUser } from '../lib/user';
import ShareButton from './ShareButton';
import DeleteButton from './DeleteButton';
import MediaItem from './MediaItem';
import LocalTime from './LocalTime';

const fileUrl = (p) => '/api/media/file?p=' + encodeURIComponent(p);
const mb = (n) => (Number(n) / 1048576).toFixed(1) + ' MB';
const iso = (d) => new Date(d).toISOString();
const cnt = (n) => n + (n === 1 ? ' file' : ' files');

function Folder({ href, children, sub }) {
  return (
    <a href={href} style={{ width: 140, textDecoration: 'none', color: 'inherit', textAlign: 'center', display: 'block' }}>
      <svg width="72" height="58" viewBox="0 0 64 52" aria-hidden="true"><path d="M2 8a4 4 0 0 1 4-4h16l6 6h30a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" fill="#F2B63A" /></svg>
      <div style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{children}</div>
      <div className="muted" style={{ fontSize: 12 }}>{sub}</div>
    </a>
  );
}

function Crumbs({ items }) {
  return (
    <p style={{ margin: '0 0 14px', fontSize: 15 }}>
      {items.map((c, i) => (
        <span key={i}>
          {i > 0 && <span className="muted"> / </span>}
          {c.href ? <a href={c.href}>{c.label}</a> : <b>{c.label}</b>}
        </span>
      ))}
    </p>
  );
}

// Dropbox-style browser for one job: section folders -> visit folders -> files.
// base is the page it is shown on ('/media' or '/admin?tab=media'); links add job / section / visit to it.
export default async function Folders({ job, section, visit, base }) {
  const u = await currentUser();
  const sql = await visitsDb();
  const link = (p) => {
    const q = ['job=' + encodeURIComponent(job)];
    if (p && p.section) q.push('section=' + encodeURIComponent(p.section));
    if (p && p.visit) q.push('visit=' + encodeURIComponent(p.visit));
    return base + (base.includes('?') ? '&' : '?') + q.join('&');
  };
  const wrap = { display: 'flex', flexWrap: 'wrap', gap: 18 };

  if (visit) {
    const [v] = await sql`select id, section_id, section_name, username, lat, lng, created_at from visits where id = ${visit} and job = ${job}`;
    if (!v) return <p className="muted">Folder not found.</p>;
    const files = await sql`select id, pathname, kind, size, share from media where visit_id = ${v.id} order by created_at`;
    const can = canManage(u, { job, username: v.username });
    const tile = { width: 100, height: 100, borderRadius: 8, overflow: 'hidden', position: 'relative' };
    return (
      <div>
        <Crumbs items={[{ label: job, href: link() }, { label: v.section_name || 'Unassigned', href: link({ section: v.section_id || 'none' }) }, { label: <LocalTime iso={iso(v.created_at)} short /> }]} />
        <p className="muted" style={{ margin: '0 0 12px', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>
            <LocalTime iso={iso(v.created_at)} />{v.username ? ' · ' + v.username : ''}
            {v.lat != null && v.lng != null && (<> &middot; <a href={'https://maps.google.com/?q=' + v.lat + ',' + v.lng} target="_blank" rel="noreferrer">map</a></>)}
          </span>
          {can && files.length > 0 && <DeleteButton kind="visit" id={v.id} label="Delete folder" />}
        </p>
        {!files.length && <p className="muted">This folder is empty.</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {files.map((m) => (
            <div key={m.id} style={tile}>
              <MediaItem url={fileUrl(m.pathname)} kind={m.kind} label={mb(m.size)} size={100} id={m.id} share={m.share} canStop={can} />
              {can && <DeleteButton kind="media" id={m.id} overlay />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section) {
    const sid = section === 'none' ? '' : section;
    const vs = await sql`select v.id, v.username, v.section_name, v.created_at, count(m.id)::int as files from visits v join media m on m.visit_id = v.id where v.job = ${job} and coalesce(v.section_id, '') = ${sid} group by v.id, v.username, v.section_name, v.created_at order by v.created_at desc`;
    let name = vs.length && vs[0].section_name ? vs[0].section_name : '';
    if (!name && sid) { const [s] = await sql`select name from sections where id = ${sid} and job = ${job}`; name = s ? s.name : ''; }
    return (
      <div>
        <Crumbs items={[{ label: job, href: link() }, { label: name || 'Unassigned' }]} />
        {sid && <ShareButton sectionId={sid} />}
        {!vs.length && <p className="muted">No photos or videos yet.</p>}
        <div style={{ ...wrap, marginTop: 12 }}>
          {vs.map((v) => (
            <Folder key={v.id} href={link({ section, visit: v.id })} sub={(v.username ? v.username + ' · ' : '') + cnt(v.files)}>
              <LocalTime iso={iso(v.created_at)} short />
            </Folder>
          ))}
        </div>
      </div>
    );
  }

  const ss = await sql`select coalesce(v.section_id, '') as sid, max(v.section_name) as name, count(m.id)::int as files from visits v join media m on m.visit_id = v.id where v.job = ${job} group by coalesce(v.section_id, '') order by max(v.section_name)`;
  return (
    <div>
      <Crumbs items={[{ label: job }]} />
      {!ss.length && <p className="muted">No photos or videos yet.</p>}
      <div style={wrap}>
        {ss.map((s) => (
          <Folder key={s.sid || 'none'} href={link({ section: s.sid || 'none' })} sub={cnt(s.files)}>{s.name || 'Unassigned'}</Folder>
        ))}
      </div>
    </div>
  );
}

import { visitsDb, canManage } from '../lib/visits';
import { getRules, limitFor, within } from '../lib/mediarules';
import { getLoc } from '../lib/locrules';
import { currentUser, canEdit } from '../lib/user';
import ShareButton from './ShareButton';
import DeleteButton from './DeleteButton';
import MediaItem from './MediaItem';
import LocalTime from './LocalTime';

const fileUrl = (p) => '/api/media/file?p=' + encodeURIComponent(p);
const mb = (n) => (Number(n) / 1048576).toFixed(1) + ' MB';
const iso = (d) => new Date(d).toISOString();
const meters = (a, b, c, d) => {
  const R = 6371000, r = (x) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const cnt = (n) => n + (n === 1 ? ' file' : ' files');
// Admin / editor distance check: green within 10 m of the QR location, orange within 100 m, red further away.
const GREEN = '#2e9d57', ORANGE = '#f08c1a', RED = '#d93025';
const col = (d, lr) => (d <= lr.green ? GREEN : d <= lr.orange ? ORANGE : RED);
const one = (d, lr) => ({ g: d <= lr.green ? 1 : 0, o: d > lr.green && d <= lr.orange ? 1 : 0, r: d > lr.orange ? 1 : 0 });

function Folder({ href, children, sub, pct }) {
  const tot = pct ? pct.g + pct.o + pct.r : 0;
  return (
    <a href={href} style={{ width: 140, textDecoration: 'none', color: 'inherit', textAlign: 'center', display: 'block' }}>
      <svg width="72" height="58" viewBox="0 0 64 52" aria-hidden="true"><path d="M2 8a4 4 0 0 1 4-4h16l6 6h30a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" fill="#F2B63A" /></svg>
      <div style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-word' }}>{children}</div>
      <div className="muted" style={{ fontSize: 12 }}>{sub}</div>
      {tot > 0 && (
        <div style={{ margin: '5px auto 0', width: 96 }}>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#e6eaed' }}>
            {pct.g > 0 && <span style={{ width: (pct.g / tot) * 100 + '%', background: GREEN }} />}
            {pct.o > 0 && <span style={{ width: (pct.o / tot) * 100 + '%', background: ORANGE }} />}
            {pct.r > 0 && <span style={{ width: (pct.r / tot) * 100 + '%', background: RED }} />}
          </div>
          <div style={{ fontSize: 12, marginTop: 3, color: GREEN, fontWeight: 600 }}>{Math.round((pct.g / tot) * 100)}% green</div>
        </div>
      )}
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
  // Admins / editors see everything. Other users see only their own visits, and never the QR scan photo.
  const edit = canEdit(u);
  const me = (u && u.name) || null;
  // Time limits set by the admin (minutes after upload; null = no limit). Admins are never limited.
  const rules = await getRules();
  const lr = await getLoc();
  const vm = limitFor(u, rules, 'view');
  const dm = limitFor(u, rules, 'delete');
  const link = (p) => {
    const q = ['job=' + encodeURIComponent(job)];
    if (p && p.section) q.push('section=' + encodeURIComponent(p.section));
    if (p && p.visit) q.push('visit=' + encodeURIComponent(p.visit));
    return base + (base.includes('?') ? '&' : '?') + q.join('&');
  };
  const wrap = { display: 'flex', flexWrap: 'wrap', gap: 18 };

  if (visit) {
    const [v] = await sql`select id, section_id, section_name, username, lat, lng, created_at from visits where id = ${visit} and job = ${job}`;
    if (!v || !canManage(u, { job, username: v.username })) return <p className="muted">Folder not found.</p>;
    const files = await sql`select id, pathname, kind, size, share, created_at from media where visit_id = ${v.id} and (${edit}::boolean or kind <> 'scan') and (${vm}::int is null or created_at > now() - make_interval(mins => ${vm}::int)) order by created_at`;
    if (!edit && !files.length) return <p className="muted">Folder not found.</p>;
    const can = canManage(u, { job, username: v.username });
    // Regular users: no date / time / map anywhere, and delete only for a limited time after uploading. Admins and editors keep everything.
    const delOk = (m) => can && (m.kind !== 'scan' || edit) && within(m.created_at, dm);
    const folderDel = can && files.length > 0 && (edit || !files.some((f) => f.kind === 'scan')) && files.every((f) => within(f.created_at, dm));
    let num = 0;
    if (!edit) { const [c] = await sql`select count(*)::int as n from visits where job = ${job} and coalesce(section_id, '') = ${v.section_id || ''} and username = ${me} and created_at <= ${v.created_at}`; num = c ? c.n : 1; }
    const upAt = files.length ? files[files.length - 1].created_at : null;
    // Admins / editors: how far the phone was from the QR location saved for this section.
    let dist = null;
    if (edit && v.section_id && v.lat != null && v.lng != null) {
      const [sl] = await sql`select lat, lng from sections where id = ${v.section_id}`;
      if (sl && sl.lat != null && sl.lng != null) dist = meters(Number(sl.lat), Number(sl.lng), Number(v.lat), Number(v.lng));
    }
    const frame = !edit ? null : dist == null ? '#9aa5ab' : col(dist, lr);
    const tile = { width: 100, height: 100, borderRadius: 8, overflow: 'hidden', position: 'relative' };
    return (
      <div>
        <Crumbs items={[{ label: job, href: link() }, { label: v.section_name || 'Unassigned', href: link({ section: v.section_id || 'none' }) }, { label: edit ? <LocalTime iso={iso(v.created_at)} short /> : 'Folder ' + num }]} />
        {(edit || folderDel) && (
          <p className="muted" style={{ margin: '0 0 12px', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {edit && (
              <span>
                Started <LocalTime iso={iso(v.created_at)} />{v.username ? ' · ' + v.username : ''}
                {upAt && (<> &middot; uploaded <LocalTime iso={iso(upAt)} /></>)}
                {v.lat != null && v.lng != null && (<> &middot; <a href={'https://maps.google.com/?q=' + v.lat + ',' + v.lng} target="_blank" rel="noreferrer">map</a></>)}
                {dist != null && (<> &middot; <b style={{ color: dist > 150 ? '#b00020' : 'inherit' }}>{Math.round(dist)} m from the QR location</b></>)}
              </span>
            )}
            {folderDel && <DeleteButton kind="visit" id={v.id} label="Delete folder" />}
          </p>
        )}
        {edit && (
          <p className="muted" style={{ margin: '0 0 10px', fontSize: 12 }}>
            {dist == null ? 'Gray frame: no QR location (or no GPS) saved, so the distance cannot be checked.' : (<>Frame: <b style={{ color: GREEN }}>green</b> within {lr.green} m of the QR &middot; <b style={{ color: ORANGE }}>orange</b> within {lr.orange} m &middot; <b style={{ color: RED }}>red</b> further away</>)}
          </p>
        )}
        {!files.length && <p className="muted">This folder is empty.</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {files.map((m) => (
            <div key={m.id} style={tile}>
              <MediaItem url={fileUrl(m.pathname)} kind={m.kind} label={mb(m.size)} size={100} id={m.id} share={m.share} canStop={can} />
              {frame && <span style={{ position: 'absolute', inset: 0, border: '4px solid ' + frame, borderRadius: 8, pointerEvents: 'none', zIndex: 2 }} />}
              {delOk(m) && <DeleteButton kind="media" id={m.id} overlay />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (section) {
    const sid = section === 'none' ? '' : section;
    const vs = await sql`select v.id, v.username, v.section_name, v.created_at, count(m.id)::int as files from visits v join media m on m.visit_id = v.id and (${edit}::boolean or m.kind <> 'scan') and (${vm}::int is null or m.created_at > now() - make_interval(mins => ${vm}::int)) where v.job = ${job} and (${edit}::boolean or v.username = ${me}) and coalesce(v.section_id, '') = ${sid} group by v.id, v.username, v.section_name, v.created_at order by v.created_at desc`;
    const dmap = {};
    if (edit && sid) {
      const dr = await sql`select v.id, 2 * 6371000 * asin(sqrt(least(1, power(sin(radians(v.lat::float8 - s.lat::float8) / 2), 2) + cos(radians(s.lat::float8)) * cos(radians(v.lat::float8)) * power(sin(radians(v.lng::float8 - s.lng::float8) / 2), 2)))) as d from visits v join sections s on s.id = v.section_id where v.job = ${job} and v.section_id = ${sid} and s.lat is not null and s.lng is not null and v.lat is not null and v.lng is not null`;
      for (const r of dr) dmap[r.id] = Number(r.d);
    }
    let name = vs.length && vs[0].section_name ? vs[0].section_name : '';
    if (!name && sid) { const [s] = await sql`select name from sections where id = ${sid} and job = ${job}`; name = s ? s.name : ''; }
    return (
      <div>
        <Crumbs items={[{ label: job, href: link() }, { label: name || 'Unassigned' }]} />
        {sid && edit && <ShareButton sectionId={sid} />}
        {!vs.length && <p className="muted">No photos or videos yet.</p>}
        <div style={{ ...wrap, marginTop: 12 }}>
          {vs.map((v, i) => (
            <Folder key={v.id} href={link({ section, visit: v.id })} sub={(edit && v.username ? v.username + ' · ' : '') + cnt(v.files) + (dmap[v.id] != null ? ' · ' + Math.round(dmap[v.id]) + ' m' : '')} pct={dmap[v.id] != null ? one(dmap[v.id], lr) : null}>
              {edit ? <LocalTime iso={iso(v.created_at)} short /> : 'Folder ' + (vs.length - i)}
            </Folder>
          ))}
        </div>
      </div>
    );
  }

  const ss = await sql`select s.id as sid, s.name, (select count(*)::int from media m join visits v on v.id = m.visit_id where v.section_id = s.id and (${edit}::boolean or (v.username = ${me} and m.kind <> 'scan')) and (${vm}::int is null or m.created_at > now() - make_interval(mins => ${vm}::int))) as files from sections s where s.job = ${job} order by s.name`;
  const [un] = await sql`select count(m.id)::int as files from visits v join media m on m.visit_id = v.id where v.job = ${job} and v.section_id is null and (${edit}::boolean or (v.username = ${me} and m.kind <> 'scan')) and (${vm}::int is null or m.created_at > now() - make_interval(mins => ${vm}::int))`;
  if (un && un.files) ss.push({ sid: '', name: 'Unassigned', files: un.files });
  const pk = {};
  if (edit) {
    const br = await sql`select sid, count(*) filter (where d <= ${lr.green})::int as g, count(*) filter (where d > ${lr.green} and d <= ${lr.orange})::int as o, count(*) filter (where d > ${lr.orange})::int as r from (select v.section_id as sid, 2 * 6371000 * asin(sqrt(least(1, power(sin(radians(v.lat::float8 - s.lat::float8) / 2), 2) + cos(radians(s.lat::float8)) * cos(radians(v.lat::float8)) * power(sin(radians(v.lng::float8 - s.lng::float8) / 2), 2)))) as d from media m join visits v on v.id = m.visit_id join sections s on s.id = v.section_id where v.job = ${job} and s.lat is not null and s.lng is not null and v.lat is not null and v.lng is not null and (${vm}::int is null or m.created_at > now() - make_interval(mins => ${vm}::int))) t group by sid`;
    for (const r of br) pk[r.sid] = r;
  }
  const shown = edit ? ss : ss.filter((s) => s.files > 0);
  return (
    <div>
      <Crumbs items={[{ label: job }]} />
      {!shown.length && <p className="muted">{edit ? 'No sections yet.' : 'No photos or videos yet.'}</p>}
      <div style={wrap}>
        {shown.map((s) => (
          <Folder key={s.sid || 'none'} href={link({ section: s.sid || 'none' })} sub={cnt(s.files)} pct={edit ? pk[s.sid] : null}>{s.name || 'Unassigned'}</Folder>
        ))}
      </div>
    </div>
  );
}

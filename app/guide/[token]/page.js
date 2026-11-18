import { notFound } from 'next/navigation';
import { db } from '../../../lib/db';
import GuideMap from '../../GuideMap';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Site guide', robots: { index: false, follow: false } };

const dir = (la, lo) => 'https://www.google.com/maps/dir/?api=1&destination=' + la + ',' + lo;

// Public page (no login): anyone with the site's secret link sees where to go: the aerial map with pins, and the orientation card.
export default async function Guide({ params, searchParams }) {
  const t = String(params.token || '');
  if (!/^[a-f0-9]{20,40}$/.test(t)) notFound();
  const sql = await db();
  const [r] = await sql`select value from settings where starts_with(key, 'site:') and value->>'guide' = ${t}`;
  if (!r) notFound();
  const s = r.value, o = s.orientation || {};
  const people = s.contacts || [];
  const call = people.find((x) => x.id && x.id === o.callId), mail = people.find((x) => x.id && x.id === o.mailId);
  const only = String((searchParams && searchParams.pins) || '').split(',').filter(Boolean);
  const pins = (s.places || []).filter((p) => p.lat != null && p.lng != null && (!only.length || (p.id && only.includes(p.id))));
  const hasO = !only.length && (o.when || o.where || o.address || call || mail || (o.files || []).length || o.rules);
  const box = { border: '1px solid var(--line)', borderRadius: 10, padding: 14, background: '#fff', marginBottom: 14 };
  const btn = { display: 'inline-block', padding: '8px 14px', border: '1px solid var(--line)', borderRadius: 8, textDecoration: 'none', color: 'var(--ink)', background: '#fff', fontSize: 15 };
  return (
    <main>
      <h1 style={{ marginBottom: 4 }}>{s.name}</h1>
      <p className="muted" style={{ marginTop: 0 }}>{[s.address, s.city, s.country].filter(Boolean).join(' · ')}</p>

      {hasO && (
        <div style={box}>
          <h2 style={{ margin: '0 0 8px', fontSize: 19 }}>Orientation</h2>
          <p style={{ margin: '0 0 8px' }}>Everyone attends this meeting before entering the site.</p>
          {o.when && <p style={{ margin: '4px 0' }}><b>When:</b> {o.when}</p>}
          {(o.where || o.address) && <p style={{ margin: '4px 0' }}><b>Where:</b> {[o.where, o.address].filter(Boolean).join(', ')}</p>}
          {o.lat != null && <p style={{ margin: '8px 0' }}><a style={btn} href={dir(o.lat, o.lng)} target="_blank" rel="noreferrer">Directions to the orientation</a></p>}
          {call && <p style={{ margin: '4px 0' }}><b>Call before you come:</b> {call.name}{call.role ? ' (' + call.role + ')' : ''}{call.phone ? ' ' : ''}{call.phone && <a href={'tel:' + call.phone.replace(/[^\d+]/g, '')}>{call.phone}</a>}</p>}
          {mail && <p style={{ margin: '4px 0' }}><b>Send the email to:</b> {mail.name}{mail.email ? ' ' : ''}{mail.email && <a href={'mailto:' + mail.email}>{mail.email}</a>}</p>}
          {(o.files || []).length > 0 && (
            <p style={{ margin: '8px 0 4px' }}><b>Forms and rules:</b><br />
              {o.files.map((f, i) => <a key={i} style={{ ...btn, margin: '4px 6px 0 0' }} href={'/guide/' + t + '/f?i=' + i + '&raw=1'} target="_blank" rel="noreferrer">{f.name}</a>)}
            </p>
          )}
          {o.rules && <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{o.rules}</p>}
        </div>
      )}

      {pins.length > 0 && (
        <div style={box}>
          <h2 style={{ margin: '0 0 8px', fontSize: 19 }}>{only.length ? 'Where to go' : 'Where things are'}</h2>
          <GuideMap pins={pins} center={s.lat != null ? { lat: s.lat, lng: s.lng } : null} height={380} />
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pins.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <b>{p.type}</b><span className="muted">{p.where}</span>
                <a style={{ marginLeft: 'auto' }} href={dir(p.lat, p.lng)} target="_blank" rel="noreferrer">Directions</a>
              </div>
            ))}
          </div>
        </div>
      )}
      {!hasO && pins.length === 0 && <p className="muted">Nothing to show yet.</p>}
    </main>
  );
}

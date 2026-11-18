import { notFound } from 'next/navigation';
import { db } from '../../../lib/db';
import ScenarioMap from '../../ScenarioMap';
import { stripAi } from '../../../lib/aitext';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Scenario', robots: { index: false, follow: false } };

// Public page (no login): anyone with the secret link sees the scenario: the picture with its pins, arrows and labels, and what to do.
export default async function Scenario({ params }) {
  const t = String(params.token || '');
  if (!/^[a-f0-9]{32}$/.test(t)) notFound();
  const sql = await db();
  const [r] = await sql`select value from settings where key = ${'scn:' + t}`;
  if (!r) notFound();
  const s = r.value;
  const image = s.base === 'image' && s.image ? { url: '/scenario/' + t + '/img', w: s.image.w, h: s.image.h } : null;
  const desc = stripAi(s.desc);
  const box = { border: '1px solid var(--line)', borderRadius: 10, padding: 14, background: '#fff', marginBottom: 14 };
  return (
    <main>
      <h1 style={{ marginBottom: 12 }}>{s.name}</h1>
      <div style={box}>
        <ScenarioMap base={image ? 'image' : 'aerial'} image={image} pins={s.pins || []} marks={s.marks || []} view={s.view} height={440} />
      </div>
      {desc && <div style={box}><h2 style={{ margin: '0 0 8px', fontSize: 19 }}>What to do</h2><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{desc}</p></div>}
    </main>
  );
}

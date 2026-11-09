import { ImageResponse } from 'next/og';
export const dynamic = 'force-static';
export function generateStaticParams() {
  return [{ size: '180' }, { size: '192' }, { size: '512' }];
}

// App icon, drawn on the fly at the requested size: dark tile, an orange and a cyan block like the 3D model colors.
export async function GET(_, { params }) {
  const s = Math.min(1024, Math.max(48, parseInt(params.size, 10) || 192));
  const u = s / 100;
  return new ImageResponse(
    (
      <div style={{ width: s, height: s, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#16262e', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: s, height: 5 * u, background: '#ff8a1f', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 30 * u, top: 12 * u, width: 40 * u, height: 8 * u, background: '#ff8a1f', borderRadius: 2 * u, display: 'flex' }} />
        <div style={{ position: 'absolute', left: 30 * u, top: 21 * u, width: 40 * u, height: 14 * u, background: '#18c8d8', borderRadius: 2 * u, display: 'flex' }} />
        <div style={{ position: 'absolute', left: 0, top: 36 * u, width: s, height: 40 * u, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 * u, fontWeight: 900, letterSpacing: -1 * u }}>
          <span style={{ color: '#18c8d8' }}>S</span>
          <span style={{ color: '#ff8a1f' }}>T</span>
        </div>
        <div style={{ position: 'absolute', left: 0, top: 80 * u, width: s, display: 'flex', justifyContent: 'center', fontSize: 9 * u, letterSpacing: 1 * u, color: '#e6f3f6' }}>SINA TAEIDI</div>
      </div>
    ),
    { width: s, height: s }
  );
}

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
      <div style={{ width: s, height: s, display: 'flex', background: '#16262e', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 22 * u, top: 40 * u, width: 56 * u, height: 36 * u, background: '#18c8d8', borderRadius: 4 * u }} />
        <div style={{ position: 'absolute', left: 22 * u, top: 28 * u, width: 56 * u, height: 14 * u, background: '#ff8a1f', borderRadius: 4 * u }} />
        <div style={{ position: 'absolute', left: 36 * u, top: 50 * u, width: 28 * u, height: 4 * u, background: '#16262e', borderRadius: 2 * u }} />
        <div style={{ position: 'absolute', left: 36 * u, top: 60 * u, width: 28 * u, height: 4 * u, background: '#16262e', borderRadius: 2 * u }} />
      </div>
    ),
    { width: s, height: s }
  );
}

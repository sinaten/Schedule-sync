'use client';
// Thin line weather icons: only strokes, no fill, so the card behind shows through.
export default function WxIcon({ code, size = 16, color = '#6b675c' }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, style: { display: 'block' } };
  const cloud = <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 9.5a4.25 4.25 0 0 1 .5 8.5H7z" />;
  if (code >= 95) return <svg {...p}>{cloud}<path d="M12.5 12l-2 3.5h3l-2 3.5" /></svg>;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <svg {...p}>{cloud}<path d="M9 21v0M12 21v0M15 21v0" strokeWidth="2.2" /></svg>;
  if (code >= 51) return <svg {...p}>{cloud}<path d="M9 20.5l-.7 1.5M13 20.5l-.7 1.5M17 20.5l-.7 1.5" /></svg>;
  if (code >= 45) return <svg {...p}><path d="M4 9h16M3 13h18M6 17h12" /></svg>;
  if (code >= 3) return <svg {...p}>{cloud}</svg>;
  if (code >= 1) return <svg {...p}><circle cx="8.5" cy="8.5" r="2.7" /><path d="M8.5 3v1M3 8.5h1M4.6 4.6l.7.7M12.4 4.6l-.7.7" /><path d="M9 20a3.5 3.5 0 0 1-.4-6.98A4.6 4.6 0 0 1 17.5 13a3.5 3.5 0 0 1 .3 7H9z" /></svg>;
  return <svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" /></svg>;
}

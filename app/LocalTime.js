'use client';
import { useEffect, useState } from 'react';

// Shows a timestamp in the viewer's own time zone, e.g. "Nov 9, 2026, 9:35 PM EST · New York".
export default function LocalTime({ iso, short }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    try {
      const d = new Date(iso);
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const city = tz.split('/').pop().replace(/_/g, ' ');
      const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
      setS(date + ', ' + time + (city && !short ? ' · ' + city : ''));
    } catch (e) { /* keep UTC fallback */ }
  }, [iso, short]);
  return <span suppressHydrationWarning>{s || new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'}</span>;
}

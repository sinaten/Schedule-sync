'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Full-screen map to drop a pin (Leaflet + OpenStreetMap / Esri satellite, no API key). Tap or click the map, drag the pin to adjust.
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (window.__leafletP) return window.__leafletP;
  window.__leafletP = new Promise((res, rej) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = CDN + 'leaflet.min.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = CDN + 'leaflet.min.js';
    s.onload = () => res(window.L);
    s.onerror = () => { window.__leafletP = null; rej(new Error('Could not load the map. Check the connection.')); };
    document.head.appendChild(s);
  });
  return window.__leafletP;
}

export default function MapPicker({ title, lat, lng, onSave, onClose }) {
  const el = useRef(null);
  const api = useRef({});
  const [pos, setPos] = useState(lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let map = null, marker = null, dead = false;
    loadLeaflet().then((L) => {
      if (dead || !el.current) return;
      L.Icon.Default.mergeOptions({ iconUrl: CDN + 'images/marker-icon.png', iconRetinaUrl: CDN + 'images/marker-icon-2x.png', shadowUrl: CDN + 'images/marker-shadow.png' });
      const has = lat != null && lng != null;
      map = L.map(el.current).setView(has ? [Number(lat), Number(lng)] : [39.9612, -82.9988], has ? 18 : 12);
      const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' });
      const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri' });
      street.addTo(map);
      L.control.layers({ Street: street, Satellite: sat }).addTo(map);
      const put = (ll) => {
        if (marker) marker.setLatLng(ll);
        else {
          marker = L.marker(ll, { draggable: true }).addTo(map);
          marker.on('dragend', () => { const p = marker.getLatLng(); setPos({ lat: p.lat, lng: p.lng }); });
        }
        setPos({ lat: ll.lat, lng: ll.lng });
      };
      if (has) put(L.latLng(Number(lat), Number(lng)));
      map.on('click', (e) => put(e.latlng));
      api.current = { map, goto: (la, lo) => map.setView([la, lo], 18) };
      if (!has && navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => { if (!dead && !marker) map.setView([p.coords.latitude, p.coords.longitude], 17); }, () => {}, { timeout: 5000 });
    }).catch((e) => setErr(e.message || 'Map failed'));
    return () => { dead = true; if (map) map.remove(); };
  }, []);

  async function search() {
    if (!q.trim()) return;
    setErr('');
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q.trim()));
      const j = await r.json();
      if (j && j[0] && api.current.goto) api.current.goto(Number(j[0].lat), Number(j[0].lon));
      else setErr('Address not found');
    } catch (e) { setErr('Search failed'); }
  }
  async function save() {
    setBusy(true);
    const ok = await onSave(pos);
    setBusy(false);
    if (ok) onClose();
  }

  const b = { font: 'inherit', fontSize: 15, padding: '9px 14px', borderRadius: 10, border: '1px solid #cfd8dc', background: '#fff', cursor: 'pointer' };
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid #e1e5e8', paddingTop: 'max(10px, env(safe-area-inset-top))' }}>
        <b style={{ flex: '0 1 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</b>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }} placeholder="Find an address" style={{ flex: 1, minWidth: 0, padding: 9, fontSize: 15 }} />
        <button type="button" style={b} onClick={search}>Find</button>
        <button type="button" style={b} onClick={onClose} aria-label="Close">&times;</button>
      </div>
      <div ref={el} style={{ flex: 1, background: '#eef1f3' }} />
      <div style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #e1e5e8', paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        <span style={{ flex: 1, fontSize: 14, minWidth: 160 }}>{err ? <b style={{ color: '#b00020' }}>{err}</b> : pos ? pos.lat.toFixed(6) + ', ' + pos.lng.toFixed(6) : 'Tap the map to drop a pin'}</span>
        <button type="button" style={{ ...b, background: '#16262e', color: '#fff', border: 0 }} disabled={!pos || busy} onClick={save}>{busy ? 'Saving…' : 'Save location'}</button>
      </div>
    </div>,
    document.body
  );
}

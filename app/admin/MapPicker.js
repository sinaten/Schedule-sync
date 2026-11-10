'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Map popup to drop a pin (Leaflet + CARTO / Esri satellite, no API key). Click the map or drag the pin. Address search suggests while typing (Photon, OpenStreetMap data).
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

function label(f) {
  const p = f.properties || {};
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const main = p.name && p.name !== street ? p.name : street || p.name || '';
  const rest = [p.name && street && p.name !== street ? street : '', p.city || p.town || p.village || p.district, p.state, p.country].filter(Boolean).join(', ');
  return { main: main || rest, rest: main ? rest : '' };
}

export default function MapPicker({ title, lat, lng, onSave, onClose }) {
  const el = useRef(null);
  const api = useRef({});
  const [pos, setPos] = useState(lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [sat, setSat] = useState(false);
  const [small, setSmall] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const f = () => setSmall(window.innerWidth < 700);
    f(); window.addEventListener('resize', f);
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('resize', f); window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    let map = null, marker = null, dead = false;
    loadLeaflet().then((L) => {
      if (dead || !el.current) return;
      L.Icon.Default.mergeOptions({ iconUrl: CDN + 'images/marker-icon.png', iconRetinaUrl: CDN + 'images/marker-icon-2x.png', shadowUrl: CDN + 'images/marker-shadow.png' });
      const has = lat != null && lng != null;
      map = L.map(el.current, { zoomControl: true }).setView(has ? [Number(lat), Number(lng)] : [39.9612, -82.9988], has ? 18 : 12);
      const street = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri, HERE, OpenStreetMap contributors' });
      const satl = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri' });
      street.addTo(map);
      const put = (ll) => {
        if (marker) marker.setLatLng(ll);
        else {
          marker = L.marker(ll, { draggable: true }).addTo(map);
          marker.on('dragend', () => { const p = marker.getLatLng(); setPos({ lat: p.lat, lng: p.lng }); });
        }
        setPos({ lat: ll.lat, lng: ll.lng });
      };
      if (has) put(L.latLng(Number(lat), Number(lng)));
      map.on('click', (e) => { setOpen(false); put(e.latlng); });
      api.current = {
        map,
        goto: (la, lo, drop) => { map.setView([la, lo], 18); if (drop) put(L.latLng(la, lo)); },
        layer: (s) => { if (s) { map.removeLayer(street); satl.addTo(map); } else { map.removeLayer(satl); street.addTo(map); } },
        center: () => map.getCenter(),
      };
      setTimeout(() => map && map.invalidateSize(), 50);
      if (!has && navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => { if (!dead && !marker) map.setView([p.coords.latitude, p.coords.longitude], 17); }, () => {}, { timeout: 5000 });
    }).catch((e) => setErr(e.message || 'Map failed'));
    return () => { dead = true; if (map) map.remove(); };
  }, []);

  useEffect(() => { if (api.current.layer) api.current.layer(sat); }, [sat]);

  // Suggest addresses while typing
  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) { setList([]); return; }
    const id = ++seq.current;
    const h = setTimeout(async () => {
      try {
        const c = api.current.center ? api.current.center() : { lat: 39.96, lng: -82.99 };
        const r = await fetch('https://photon.komoot.io/api/?limit=6&lang=en&lat=' + c.lat + '&lon=' + c.lng + '&q=' + encodeURIComponent(t));
        const j = await r.json();
        if (id !== seq.current) return;
        setList((j.features || []).filter((f) => f.geometry && f.geometry.coordinates));
        setSel(-1); setOpen(true); setErr('');
      } catch (e) { if (id === seq.current) setList([]); }
    }, 250);
    return () => clearTimeout(h);
  }, [q]);

  function choose(f) {
    const [lo, la] = f.geometry.coordinates;
    const l = label(f);
    setQ(l.main + (l.rest ? ', ' + l.rest : ''));
    setOpen(false); setList([]);
    if (api.current.goto) api.current.goto(la, lo, true);
  }
  async function enter() {
    if (sel >= 0 && list[sel]) return choose(list[sel]);
    if (list[0]) return choose(list[0]);
    if (!q.trim()) return;
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q.trim()));
      const j = await r.json();
      if (j && j[0] && api.current.goto) api.current.goto(Number(j[0].lat), Number(j[0].lon), true);
      else setErr('Address not found');
    } catch (e) { setErr('Search failed'); }
  }
  async function save() {
    setBusy(true);
    const ok = await onSave(pos);
    setBusy(false);
    if (ok) onClose();
  }

  const b = { font: 'inherit', fontSize: 15, padding: '8px 14px', borderRadius: 10, border: '1px solid #cfd8dc', background: '#fff', cursor: 'pointer' };
  const card = small
    ? { width: '100%', height: '100%', borderRadius: 0 }
    : { width: 'min(960px, 92vw)', height: 'min(680px, 88vh)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.35)' };
  return createPortal(
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,25,30,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...card, background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'center', borderBottom: '1px solid #e1e5e8', paddingTop: small ? 'max(10px, env(safe-area-inset-top))' : 10 }}>
          <b style={{ flex: '0 1 auto', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: small ? '30%' : '38%' }}>{title}</b>
          <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
            <input value={q} autoFocus={!small}
              onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') enter();
                else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(list.length - 1, s + 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(-1, s - 1)); }
              }}
              placeholder="Search an address or place" style={{ width: '100%', boxSizing: 'border-box', padding: 9, fontSize: 15 }} />
            {open && list.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #cfd8dc', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.2)', zIndex: 3000, overflow: 'hidden' }}>
                {list.map((f, i) => { const l = label(f); return (
                  <div key={i} onMouseDown={(e) => { e.preventDefault(); choose(f); }} onMouseEnter={() => setSel(i)}
                    style={{ padding: '9px 12px', cursor: 'pointer', background: i === sel ? '#eef3f6' : '#fff', borderTop: i ? '1px solid #f0f2f4' : 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.main}</div>
                    {l.rest && <div style={{ fontSize: 13, color: '#607078', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.rest}</div>}
                  </div>); })}
              </div>
            )}
          </div>
          <button type="button" style={b} onClick={() => setSat((s) => !s)}>{sat ? 'Map' : 'Satellite'}</button>
          <button type="button" style={{ ...b, fontSize: 22, lineHeight: 1, padding: '6px 12px' }} onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div ref={el} style={{ flex: 1, background: '#eef1f3', minHeight: 0 }} />
        <div style={{ padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid #e1e5e8', paddingBottom: small ? 'max(10px, env(safe-area-inset-bottom))' : 10 }}>
          <span style={{ flex: 1, fontSize: 14, minWidth: 160 }}>{err ? <b style={{ color: '#b00020' }}>{err}</b> : pos ? pos.lat.toFixed(6) + ', ' + pos.lng.toFixed(6) : 'Click the map to drop a pin'}</span>
          <button type="button" style={b} onClick={onClose}>Cancel</button>
          <button type="button" style={{ ...b, background: '#16262e', color: '#fff', border: 0 }} disabled={!pos || busy} onClick={save}>{busy ? 'Saving…' : 'Save location'}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

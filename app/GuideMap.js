'use client';
import { useEffect, useRef } from 'react';

// Aerial map with labeled pins (Leaflet + Esri imagery, no API key). Used by the admin (editable: click to add, drag to move) and by the public guide page (read only).
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
    s.onerror = () => { window.__leafletP = null; rej(new Error('Could not load the map')); };
    document.head.appendChild(s);
  });
  return window.__leafletP;
}

export const PIN_TYPES = { Entrance: '#BA7517', Parking: '#378ADD', Restroom: '#1D9E75', 'First aid': '#E24B4A', 'Muster point': '#7F77DD', Office: '#5F5E5A', Other: '#D4537E' };
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export default function GuideMap({ pins, center, editable, onAdd, onMove, height = 340 }) {
  const el = useRef(null);
  const st = useRef({});
  const cb = useRef({});
  cb.current = { onAdd, onMove, editable };

  useEffect(() => {
    let dead = false;
    loadLeaflet().then((L) => {
      if (dead || !el.current) return;
      const has = center && center.lat != null && center.lng != null;
      const map = L.map(el.current, { zoomControl: true }).setView(has ? [center.lat, center.lng] : [39.5, -98.35], has ? 18 : 4);
      const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri' });
      const street = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri, HERE, OpenStreetMap contributors' });
      sat.addTo(map);
      L.control.layers({ Aerial: sat, Map: street }, null, { position: 'topright' }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      map.on('click', (e) => { if (cb.current.editable && cb.current.onAdd) cb.current.onAdd(e.latlng.lat, e.latlng.lng); });
      st.current = { L, map, layer, fitted: false };
      draw();
      setTimeout(() => map.invalidateSize(), 200);
    }).catch(() => {});
    return () => { dead = true; if (st.current.map) { st.current.map.remove(); st.current = {}; } };
  }, []);

  function draw() {
    const { L, map, layer } = st.current;
    if (!map) return;
    layer.clearLayers();
    const ll = [];
    (pins || []).forEach((p, i) => {
      if (p.lat == null || p.lng == null) return;
      const c = PIN_TYPES[p.type] || PIN_TYPES.Other;
      const label = esc(p.where ? p.type + ': ' + p.where : p.type);
      const icon = L.divIcon({ className: '', iconSize: [0, 0], html: '<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;pointer-events:none"><div style="width:26px;height:26px;border-radius:50%;background:' + c + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font:700 13px system-ui">' + esc((p.type || '?').slice(0, 1)) + '</div><div style="margin-top:2px;font:600 12px system-ui;background:#fff;color:#16262e;border-radius:6px;padding:1px 6px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.3)">' + label + '</div></div>' });
      const m = L.marker([p.lat, p.lng], { icon, draggable: !!cb.current.editable, keyboard: false }).addTo(layer);
      if (cb.current.editable) m.on('dragend', () => { const q = m.getLatLng(); if (cb.current.onMove) cb.current.onMove(i, q.lat, q.lng); });
      ll.push([p.lat, p.lng]);
    });
    if (!st.current.fitted && ll.length) { st.current.fitted = true; map.fitBounds(ll, { padding: [50, 50], maxZoom: 19 }); }
  }
  useEffect(() => { draw(); }, [pins, editable]);
  useEffect(() => { const { map } = st.current; if (map && center && center.lat != null && !(pins || []).some((p) => p.lat != null)) map.setView([center.lat, center.lng], 18); }, [center && center.lat, center && center.lng]);

  return <div ref={el} style={{ height, borderRadius: 10, border: '1px solid #c7d2d6', background: '#eef1f3', cursor: editable ? 'crosshair' : 'grab' }} />;
}

'use client';
import { useEffect, useRef } from 'react';
import { loadLeaflet, PIN_TYPES, esc } from './GuideMap';

// The map of a scenario: aerial view or an uploaded picture, with pins, arrows, routes and labels.
// Read only on the public page. In the admin (editable) the tool says what a click does: pin, arrow (2 clicks), route (many clicks, then Finish), text.
const RED = '#E24B4A';
export default function ScenarioMap({ base, image, pins, marks, view, center, start, frame, ratio, editable, tool, pinType, pinName, textVal, apiRef, onAddPin, onMovePin, onRenamePin, onRemovePin, onAddMark, onMoveMark, onEditMark, onRemoveMark, onSetStart, onRemoveStart, onView, onPending, height = 420 }) {
  const el = useRef(null), st = useRef({}), cb = useRef({}), pend = useRef([]);
  cb.current = { editable, tool, pinType, pinName, textVal, onAddPin, onMovePin, onRenamePin, onRemovePin, onAddMark, onMoveMark, onEditMark, onRemoveMark, onSetStart, onRemoveStart, onView, onPending };
  const img = image && image.url ? image : null;

  useEffect(() => {
    let dead = false;
    loadLeaflet().then((L) => {
      if (dead || !el.current) return;
      let map;
      if (base === 'image' && img) {
        map = L.map(el.current, { crs: L.CRS.Simple, minZoom: -4, maxZoom: 4, zoomSnap: 0.25, attributionControl: false });
        const b = [[0, 0], [img.h, img.w]];
        L.imageOverlay(img.url, b).addTo(map);
        map.fitBounds(b);
        if (cb.current.editable) map.setMaxBounds([[-img.h * 0.5, -img.w * 0.5], [img.h * 1.5, img.w * 1.5]]);
        else { map.setMinZoom(map.getZoom()); map.setMaxBounds(b); map.options.maxBoundsViscosity = 1; } // read only: you can zoom in, never out of the picture
      } else {
        const has = (view && view.lat != null) || (center && center.lat != null);
        const c = view && view.lat != null ? [view.lat, view.lng] : has ? [center.lat, center.lng] : [39.5, -98.35];
        map = L.map(el.current, { zoomControl: true, zoomSnap: frame ? 0.25 : 1 }).setView(c, view && view.zoom != null ? view.zoom : has ? 18 : 4);
        if (frame) { map.fitBounds(frame, { animate: false }); map.setMinZoom(map.getZoom()); map.setMaxBounds(frame); map.options.maxBoundsViscosity = 1; } // the same frame for everyone: you can zoom in, never out
        const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri', crossOrigin: true });
        const street = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri, HERE, OpenStreetMap contributors', crossOrigin: true });
        sat.addTo(map);
        if (!frame) L.control.layers({ Aerial: sat, Map: street }, null, { position: 'topright' }).addTo(map);
      }
      const layer = L.layerGroup().addTo(map), tmp = L.layerGroup().addTo(map);
      st.current = { L, map, layer, tmp, fitted: false };
      map.on('click', (e) => click(e.latlng));
      map.on('dblclick', () => {});
      map.on('zoomend', () => draw());
      map.on('moveend', () => { if (cb.current.onView) { const c = map.getCenter(), bb = map.getBounds(); cb.current.onView({ lat: c.lat, lng: c.lng, zoom: map.getZoom(), bounds: [[bb.getSouth(), bb.getWest()], [bb.getNorth(), bb.getEast()]] }); } });
      if (apiRef) apiRef.current = { finishRoute, cancelPending };
      if (cb.current.editable && cb.current.tool === 'move') map.dragging.disable();
      draw(); drawTmp();
      setTimeout(() => map.invalidateSize(), 200);
    }).catch(() => {});
    return () => { dead = true; if (st.current.map) { st.current.map.remove(); st.current = {}; } };
  }, [base, img && img.url, frame ? 1 : 0]);

  function cancelPending() { pend.current = []; drawTmp(); if (cb.current.onPending) cb.current.onPending(0); }
  function finishRoute() {
    const p = pend.current;
    if (p.length >= 2 && cb.current.onAddMark) cb.current.onAddMark({ id: Math.random().toString(36).slice(2, 10), k: 'route', pts: p.map((x) => [x[0], x[1]]), text: '' });
    cancelPending();
  }
  function click(ll) {
    const c = cb.current;
    if (!c.editable) return;
    const pt = [ll.lat, ll.lng], now = Date.now(), lc = st.current.lastClick;
    if (lc && now - lc.t < 300 && lc.la === pt[0] && lc.lo === pt[1]) return; // the same tap reported twice
    st.current.lastClick = { t: now, la: pt[0], lo: pt[1] };
    if (c.tool === 'start') { if (c.onSetStart && base !== 'image') c.onSetStart(pt[0], pt[1]); return; }
    if (c.tool === 'pin') { if (c.onAddPin) c.onAddPin(pt[0], pt[1]); return; }
    if (c.tool === 'text') { if (c.textVal && c.textVal.trim() && c.onAddMark) c.onAddMark({ id: Math.random().toString(36).slice(2, 10), k: 'text', pts: [pt], text: c.textVal.trim() }); return; }
    if (c.tool === 'arrow') {
      pend.current = [...pend.current, pt];
      if (pend.current.length >= 2) { if (c.onAddMark) c.onAddMark({ id: Math.random().toString(36).slice(2, 10), k: 'arrow', pts: pend.current.slice(0, 2), text: '' }); pend.current = []; }
    } else if (c.tool === 'route') pend.current = [...pend.current, pt];
    else return;
    drawTmp(); if (c.onPending) c.onPending(pend.current.length);
  }
  function head(L, map, a, b, color) {
    const pa = map.latLngToLayerPoint(a), pb = map.latLngToLayerPoint(b);
    const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180 / Math.PI;
    return L.marker(b, { interactive: false, keyboard: false, icon: L.divIcon({ className: '', iconSize: [0, 0], html: '<div style="position:absolute;left:0;top:0;transform:translate(-50%,-50%) rotate(' + ang + 'deg)"><svg width="30" height="30" viewBox="-15 -15 30 30"><polygon points="13,0 -9,-10 -5,0 -9,10" fill="' + color + '" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></div>' }) });
  }
  function drawTmp() {
    const { L, map, tmp } = st.current; if (!map) return;
    tmp.clearLayers();
    const p = pend.current; if (!p.length) return;
    p.forEach((q) => L.circleMarker(q, { radius: 5, color: '#fff', weight: 2, fillColor: RED, fillOpacity: 1, interactive: false }).addTo(tmp));
    if (p.length >= 2) L.polyline(p, { color: RED, weight: 4, dashArray: '6 6', interactive: false }).addTo(tmp);
  }
  function box(i, list, kind) {
    const d = document.createElement('div'); d.style.cssText = 'display:flex;flex-direction:column;gap:6px;min-width:170px';
    const bs = 'padding:6px;font-size:15px;border-radius:6px;cursor:pointer;';
    if (kind === 'pin' || kind === 'text') {
      const inp = document.createElement('input'); inp.value = kind === 'pin' ? (list[i].where || '') : (list[i].text || ''); inp.placeholder = kind === 'pin' ? 'Name of this pin' : 'Text';
      inp.style.cssText = 'padding:6px;font-size:15px;border:1px solid #c7d2d6;border-radius:6px';
      inp.addEventListener('change', () => { const c = cb.current; if (kind === 'pin') c.onRenamePin && c.onRenamePin(i, inp.value); else c.onEditMark && c.onEditMark(list[i].id, inp.value); });
      d.appendChild(inp);
    }
    const del = document.createElement('button'); del.type = 'button'; del.textContent = 'Delete';
    del.style.cssText = bs + 'border:1px solid ' + RED + ';color:' + RED + ';background:#fff';
    del.addEventListener('click', () => { const c = cb.current; if (kind === 'pin') c.onRemovePin && c.onRemovePin(i); else c.onRemoveMark && c.onRemoveMark(list[i].id); });
    d.appendChild(del); return d;
  }
  function draw() {
    const { L, map, layer } = st.current; if (!map) return;
    layer.clearLayers();
    const ed = !!cb.current.editable, ll = [];
    (marksRef.current || []).forEach((m, i, arr) => {
      if (m.k === 'text') {
        const mk = L.marker(m.pts[0], { draggable: ed, keyboard: false, icon: L.divIcon({ className: '', iconSize: [0, 0], html: '<div style="position:absolute;transform:translate(-50%,-50%);background:#fff7c2;color:#16262e;border:2px solid ' + RED + ';border-radius:8px;padding:3px 8px;font:700 14px system-ui;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:' + (ed ? 'pointer' : 'default') + '">' + esc(m.text) + '</div>' }) }).addTo(layer);
        if (ed) { mk.bindPopup(box(i, arr, 'text')); mk.on('dragend', () => { const q = mk.getLatLng(); cb.current.onMoveMark && cb.current.onMoveMark(m.id, [q.lat, q.lng]); }); }
        ll.push(m.pts[0]); return;
      }
      L.polyline(m.pts, { color: '#fff', weight: 8, opacity: 0.9, interactive: false }).addTo(layer);
      L.polyline(m.pts, { color: RED, weight: 4, interactive: false }).addTo(layer);
      const pl = ed ? L.polyline(m.pts, { color: RED, weight: 30, opacity: 0.001, interactive: true, bubblingMouseEvents: false }).addTo(layer) : null;
      head(L, map, m.pts[m.pts.length - 2], m.pts[m.pts.length - 1], RED).addTo(layer);
      if (pl) pl.bindPopup(box(i, arr, 'mark'));
      m.pts.forEach((q) => ll.push(q));
    });
    (pinsRef.current || []).forEach((p, i, arr) => {
      const c = PIN_TYPES[p.type] || PIN_TYPES.Other;
      const label = esc(p.where ? (p.type === 'Other' ? p.where : p.type + ': ' + p.where) : p.type);
      const icon = L.divIcon({ className: '', iconSize: [0, 0], popupAnchor: [0, -34], html: '<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;pointer-events:none"><div style="pointer-events:auto;cursor:pointer;width:26px;height:26px;border-radius:50%;background:' + c + ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font:700 13px system-ui">' + esc((p.type || '?').slice(0, 1)) + '</div><div style="margin-top:2px;font:600 12px system-ui;background:#fff;color:#16262e;border-radius:6px;padding:1px 6px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.3)">' + label + '</div></div>' });
      const m = L.marker([p.lat, p.lng], { icon, draggable: ed, keyboard: false }).addTo(layer);
      if (ed) { m.bindPopup(box(i, arr, 'pin')); m.on('dragend', () => { const q = m.getLatLng(); cb.current.onMovePin && cb.current.onMovePin(i, q.lat, q.lng); }); }
      ll.push([p.lat, p.lng]);
    });
    const sp = startRef.current;
    if (sp && base !== 'image' && sp.lat != null) {
      const sic = L.divIcon({ className: '', iconSize: [0, 0], popupAnchor: [0, -40], html: '<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center"><svg width="34" height="44" viewBox="0 0 34 44"><path d="M17 43C17 43 3 27 3 16a14 14 0 0 1 28 0c0 11-14 27-14 27z" fill="#E24B4A" stroke="#fff" stroke-width="3"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg><div style="margin-top:2px;font:700 12px system-ui;background:#E24B4A;color:#fff;border-radius:6px;padding:2px 7px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4)">Start' + (sp.name ? ': ' + esc(sp.name) : '') + '</div></div>' });
      const sm = L.marker([sp.lat, sp.lng], { icon: sic, keyboard: false, zIndexOffset: 1000, draggable: ed }).addTo(layer);
      if (ed) {
        const bx = document.createElement('div'); bx.style.cssText = 'display:flex;flex-direction:column;gap:6px;min-width:150px';
        const dl = document.createElement('button'); dl.type = 'button'; dl.textContent = 'Delete the start pin';
        dl.style.cssText = 'padding:6px;font-size:15px;border:1px solid ' + RED + ';color:' + RED + ';background:#fff;border-radius:6px;cursor:pointer';
        dl.addEventListener('click', () => { cb.current.onRemoveStart && cb.current.onRemoveStart(); });
        bx.appendChild(dl); sm.bindPopup(bx);
        sm.on('dragend', () => { const q = sm.getLatLng(); cb.current.onSetStart && cb.current.onSetStart(q.lat, q.lng); });
      } else sm.on('click', () => { window.open('https://www.google.com/maps/dir/?api=1&destination=' + sp.lat + ',' + sp.lng, '_blank', 'noopener'); });
    }
    if (!st.current.fitted && ll.length && !(view && view.lat != null) && !frame) { st.current.fitted = true; map.fitBounds(ll, { padding: [50, 50], maxZoom: base === 'image' ? 3 : 19 }); }
  }
  const pinsRef = useRef(pins), marksRef = useRef(marks), startRef = useRef(start);
  pinsRef.current = pins; marksRef.current = marks; startRef.current = start;
  useEffect(() => { draw(); }, [pins, marks, editable, start && start.lat, start && start.lng, start && start.name]);
  useEffect(() => { if (tool !== 'arrow' && tool !== 'route') cancelPending(); }, [tool]);
  // Move / edit: the map stays still, only pins, arrows and labels can be touched. Any other tool: the map can be dragged.
  useEffect(() => {
    const { map } = st.current; if (!map) return;
    if (editable && tool === 'move') map.dragging.disable(); else map.dragging.enable();
  }, [tool, editable, base, img && img.url]);

  return <div ref={el} style={{ ...(ratio ? { aspectRatio: String(ratio), width: '100%' } : { height }), borderRadius: 10, border: '1px solid #c7d2d6', background: '#eef1f3', cursor: editable && tool && tool !== 'move' ? 'crosshair' : 'grab' }} />;
}

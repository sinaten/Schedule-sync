'use client';
import { useState } from 'react';

// Home page of a regular user: only the sites where the person has work, soonest first. Tap a site: its cards. Tap a card: that project opens (read only) at the element.
const fmt = (s) => { const [, m, d] = String(s).split('-'); return m && d ? m + '/' + d : s; };
const short = (s) => (String(s).length > 16 ? String(s).slice(0, 15) + '…' : String(s));
const range = (a, b) => fmt(a) + (b && b !== a ? ' – ' + fmt(b) : '');
function Site({ s, open, onToggle }) {
  return (
    <div style={{ border: '1px solid ' + (s.now ? '#cfcab9' : '#efece3'), borderRadius: 12, background: '#fff', marginBottom: 10, overflow: 'hidden' }}>
      <button type="button" onClick={onToggle} aria-expanded={open} style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '12px 14px', border: 0, background: s.now ? '#f6f5f0' : '#fff', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{s.name}{s.place ? <span style={{ fontWeight: 400, color: '#8a877b' }}> · {s.place}</span> : null}</div>
          <div style={{ fontSize: 12, color: '#8a877b', marginTop: 2 }}>{s.projects.map(short).join(', ')} · {s.cards.length} card{s.cards.length === 1 ? '' : 's'}</div>
        </div>
        <span style={{ fontSize: 12, borderRadius: 8, padding: '3px 9px', background: s.now ? '#e3f1e8' : '#f4f3ee', color: s.now ? '#1e7a46' : '#6b675c', whiteSpace: 'nowrap' }}>{s.now ? 'Today' : range(s.start, s.end)}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a877b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && s.cards.map((c) => (
        <a key={c.job + '|' + c.element} href={'/j/' + encodeURIComponent(c.job)} style={{ display: 'block', padding: '10px 14px', borderTop: '1px solid #efece3', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}><b style={{ color: '#D97757', fontWeight: 600 }}>{c.card}<span style={{ color: '#8a877b', fontWeight: 500 }}> {'–'} {short(c.job)}</span></b><span style={{ marginLeft: 'auto', color: '#8a877b' }}>{range(c.start, c.end)}</span></div>
          <div style={{ fontSize: 14, marginTop: 2 }}>{c.title || 'Element ' + c.element}</div>
        </a>
      ))}
    </div>
  );
}
export default function HomeWork({ sites }) {
  const [openId, setOpenId] = useState('');
  const now = sites.filter((s) => s.now), later = sites.filter((s) => !s.now);
  const lab = { fontSize: 12, color: '#8a877b', letterSpacing: '.04em', margin: '14px 2px 6px' };
  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div style={{ fontSize: 13, color: '#6b675c', margin: '0 2px 4px' }}>Sites where you have work, soonest first</div>
      {!sites.length && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #efece3', borderRadius: 12, background: '#fff', padding: '14px 16px', marginTop: 10 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8a877b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9h12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M16 10h2a2 2 0 0 1 0 4h-2" /><path d="M7 4v2M10 4v2M13 4v2" /></svg>
          <div><div style={{ fontSize: 14, fontWeight: 500 }}>Nothing planned</div><div style={{ fontSize: 12.5, color: '#6b675c', marginTop: 2 }}>No work is planned for you yet.</div></div>
        </div>
      )}
      {now.length > 0 && <><div style={lab}>NOW</div>{now.map((s) => <Site key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? '' : s.id)} />)}</>}
      {later.length > 0 && <><div style={lab}>UPCOMING</div>{later.map((s) => <Site key={s.id} s={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? '' : s.id)} />)}</>}
    </div>
  );
}

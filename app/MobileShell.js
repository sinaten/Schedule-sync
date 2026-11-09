'use client';
import { useState } from 'react';

// Phone-only chrome (hidden by CSS on laptops): back / home / avatar on top, QR button at the bottom.
function initials(n) {
  const p = String(n || '').trim().split(/[\s._-]+/).filter(Boolean);
  return (p.length > 1 ? p[0][0] + p[1][0] : (p[0] || '?')[0]).toUpperCase();
}

export default function MobileShell({ name, role, admin }) {
  const [open, setOpen] = useState(false);
  const back = () => { if (history.length > 1) history.back(); else location.href = '/'; };
  return (
    <>
      <header className="ms-top">
        <button type="button" className="ms-btn" aria-label="Back" onClick={back}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#141413" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div className="ms-right">
          <a className="ms-btn" href="/" aria-label="Home">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#141413" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></svg>
          </a>
          <button type="button" className="ms-btn ms-av" aria-label="Profile and settings" aria-expanded={open} onClick={() => setOpen(!open)}>{initials(name)}</button>
        </div>
        {open && (
          <>
            <div className="ms-scrim" onClick={() => setOpen(false)} />
            <div className="ms-pop">
              <div className="ms-who"><b>{name}</b><span>{role}</span></div>
              <div className="ms-sep" />
              {admin && <a href="/admin">Admin</a>}
              <a href="/" onClick={() => setOpen(false)}>Jobs</a>
              <div className="ms-sep" />
              <a href="/api/logout" className="ms-out">Sign out</a>
            </div>
          </>
        )}
      </header>
      <div className="ms-spacer" />
      <nav className="ms-bot" aria-label="Quick actions">
        <span className="ms-sm" aria-hidden="true" />
        <span className="ms-sm" aria-hidden="true" />
        <a className="ms-qr" href="/scan" aria-label="Scan QR code">
          <svg width="46" height="46" viewBox="-1 -1 23 23" fill="#D97757" shapeRendering="crispEdges" aria-hidden="true"><path d="M0 0h7v1h-7zM8 0h2v1h-2zM11 0h1v1h-1zM14 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM8 1h2v1h-2zM11 1h2v1h-2zM14 1h1v1h-1zM20 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h3v1h-3zM12 2h1v1h-1zM14 2h1v1h-1zM16 2h3v1h-3zM20 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h1v1h-1zM12 3h1v1h-1zM14 3h1v1h-1zM16 3h3v1h-3zM20 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM9 4h1v1h-1zM11 4h2v1h-2zM14 4h1v1h-1zM16 4h3v1h-3zM20 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h2v1h-2zM11 5h1v1h-1zM14 5h1v1h-1zM20 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h7v1h-7zM9 7h1v1h-1zM11 7h2v1h-2zM0 8h1v1h-1zM2 8h2v1h-2zM5 8h3v1h-3zM10 8h1v1h-1zM15 8h1v1h-1zM17 8h2v1h-2zM20 8h1v1h-1zM0 9h2v1h-2zM7 9h1v1h-1zM11 9h1v1h-1zM14 9h1v1h-1zM16 9h1v1h-1zM0 10h2v1h-2zM3 10h6v1h-6zM10 10h3v1h-3zM14 10h2v1h-2zM20 10h1v1h-1zM0 11h2v1h-2zM4 11h2v1h-2zM7 11h3v1h-3zM11 11h4v1h-4zM0 12h1v1h-1zM5 12h4v1h-4zM10 12h11v1h-11zM10 13h3v1h-3zM16 13h5v1h-5zM0 14h7v1h-7zM8 14h2v1h-2zM11 14h2v1h-2zM14 14h1v1h-1zM16 14h2v1h-2zM0 15h1v1h-1zM6 15h1v1h-1zM9 15h4v1h-4zM16 15h1v1h-1zM0 16h1v1h-1zM2 16h3v1h-3zM6 16h1v1h-1zM10 16h1v1h-1zM12 16h5v1h-5zM19 16h1v1h-1zM0 17h1v1h-1zM2 17h3v1h-3zM6 17h1v1h-1zM10 17h5v1h-5zM18 17h1v1h-1zM0 18h1v1h-1zM2 18h3v1h-3zM6 18h1v1h-1zM8 18h1v1h-1zM13 18h2v1h-2zM16 18h1v1h-1zM19 18h2v1h-2zM0 19h1v1h-1zM6 19h1v1h-1zM10 19h3v1h-3zM15 19h1v1h-1zM19 19h1v1h-1zM0 20h7v1h-7zM8 20h2v1h-2zM14 20h1v1h-1zM17 20h4v1h-4z" /></svg>
        </a>
        <span className="ms-sm" aria-hidden="true" />
        <span className="ms-sm" aria-hidden="true" />
      </nav>
    </>
  );
}

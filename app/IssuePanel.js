'use client';
import { useEffect, useRef, useState } from 'react';

const OR = '#e8710a';
const when = (t) => { const d = new Date(t); return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
const url = (p) => '/api/issue/file?p=' + encodeURIComponent(p);
// Shrinks a phone photo so it fits the upload limit.
async function shrink(file) {
  if (!file.type.startsWith('image/') || file.size < 900 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
    return b ? new File([b], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) { return file; }
}

const titleSt = { position: 'sticky', top: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #efece3', fontWeight: 700, fontSize: 14.5 };
// Bottom sheet (defined outside the panel so typing in it never loses focus).
function Sheet({ children, name, foot, close }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(20,20,19,.4)', display: 'flex', alignItems: 'flex-end' }} onClick={close}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, margin: '0 auto', height: '72vh', background: '#fff', borderRadius: '20px 20px 0 0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={titleSt}><span>{name}</span><button type="button" onClick={close} aria-label="Close" style={{ border: 0, background: '#f1ede4', width: 30, height: 30, borderRadius: 15, fontSize: 16, cursor: 'pointer' }}>{'✕'}</button></div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>{children}</div>
        {foot}
      </div>
    </div>
  );
}

// Issue card of one part: description, comments chat, files and photos.
export default function IssuePanel({ job, element, onMsg }) {
  const [d, setD] = useState(null);
  const [text, setText] = useState('');
  const [sheet, setSheet] = useState('');
  const [chat, setChat] = useState('');
  const [busy, setBusy] = useState(false);
  const [cam, setCam] = useState(false);
  const photoRef = useRef(null), fileRef = useRef(null), chatPhotoRef = useRef(null), endRef = useRef(null), loaded = useRef('');
  const q = '?job=' + encodeURIComponent(job) + '&element=' + encodeURIComponent(element);

  const load = async () => {
    try {
      const r = await fetch('/api/issue' + q, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setD(j);
      if (loaded.current !== element) { loaded.current = element; setText((j.issue && j.issue.description) || ''); }
    } catch (e) {}
  };
  useEffect(() => { loaded.current = ''; setD(null); setSheet(''); load(); }, [job, element]);
  useEffect(() => { if (sheet !== 'comments') return; const t = setInterval(load, 6000); return () => clearInterval(t); }, [sheet, job, element]);
  useEffect(() => { if (sheet === 'comments' && endRef.current) endRef.current.scrollIntoView({ block: 'end' }); }, [sheet, d]);

  // Add photo = the same camera flow as the QR button: scan the section QR, then take photos into your folder; they also land in this issue.
  const openCam = async () => {
    if (!(d && d.issue)) { try { await fetch('/api/issue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, element, description: text }) }); } catch (e) {} }
    try { sessionStorage.setItem('issuectx', JSON.stringify({ job, element })); } catch (e) {}
    setCam(true);
  };
  useEffect(() => {
    if (!cam) return;
    const f = (e) => { if (e.origin === location.origin && e.data === 'issue-close') { try { sessionStorage.removeItem('issuectx'); } catch (x) {} setCam(false); load(); } };
    window.addEventListener('message', f);
    return () => window.removeEventListener('message', f);
  }, [cam, job, element]);

  const me = d ? d.me : '';
  const items = d ? d.items : [];
  const comments = items.filter((i) => i.kind === 'comment' || (i.kind === 'photo' && i.body === 'chat'));
  const files = items.filter((i) => i.kind === 'file');
  const photos = items.filter((i) => i.kind === 'photo');
  const author = d && d.issue ? d.issue.author : '';
  const locked = !!author && author !== me;

  const saveText = async () => {
    if (locked || !d || text === ((d.issue && d.issue.description) || '')) return;
    const r = await fetch('/api/issue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, element, description: text }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); onMsg && onMsg(j.error || 'Could not save the issue.'); return; }
    loaded.current = element; load();
  };
  // the first save creates the issue record so the author is the person who raised it
  const saveText0 = async () => { await fetch('/api/issue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, element, description: text }) }); };
  const upload = async (file, kind, asChat) => {
    if (!file) return;
    setBusy(true);
    try {
      if (!(d && d.issue)) await saveText0();
      const f = kind === 'photo' ? await shrink(file) : file;
      const fd = new FormData(); fd.append('file', f); fd.append('job', job); fd.append('element', element); fd.append('kind', kind); if (asChat) fd.append('chat', '1');
      const r = await fetch('/api/issue/upload', { method: 'POST', body: fd });
      if (!r.ok) { const j = await r.json().catch(() => ({})); onMsg && onMsg(j.error || 'Upload failed.'); }
      await load();
    } catch (e) { onMsg && onMsg('No connection to the website.'); }
    setBusy(false);
  };
  const send = async () => {
    const body = chat.trim(); if (!body) return;
    setChat('');
    if (!(d && d.issue)) await saveText0();
    const r = await fetch('/api/issue', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, element, action: 'comment', body }) });
    if (!r.ok) { setChat(body); onMsg && onMsg('Could not send.'); }
    load();
  };
  const del = async (id) => { if (!window.confirm('Delete this?')) return; await fetch('/api/issue?id=' + id, { method: 'DELETE' }); load(); };

  const pill = (on) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1.5px solid ' + (on ? OR : '#d9d5c8'), background: '#fff', color: on ? OR : '#6b675c', borderRadius: 14, padding: '4px 10px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' });
  const tab = { flex: 1, border: 0, background: 'transparent', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: '#141413', padding: '9px 4px', cursor: 'pointer' };
  const cnt = (n) => <span style={{ marginLeft: 4, background: n ? OR : '#e7e3d8', color: n ? '#fff' : '#8a8576', borderRadius: 9, padding: '1px 7px', fontSize: 11.5 }}>{n}</span>;
  return (
    <div style={{ margin: '0 12px 10px', border: '1px solid #f0d9bf', borderRadius: 14, background: '#fffaf4', padding: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#8a4a0a', marginBottom: 8 }}>
        {d && d.issue ? 'Issue by ' + d.issue.author + ' · ' + when(d.issue.created_at) : d ? 'Issue by ' + (me || 'you') : 'Loading…'}
      </div>
      <div style={{ border: '1px solid #e7e3d8', borderRadius: 12, background: '#fff', padding: 8 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={saveText} readOnly={locked} placeholder={locked ? 'No description yet.' : 'Describe the issue…'} rows={4}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', border: 0, outline: 'none', resize: 'none', font: 'inherit', fontSize: 14, color: '#141413', background: 'transparent' }} />
        {!locked && (
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" disabled={busy} onClick={() => openCam()} style={pill(true)}>{'📷'} Add photo</button>
            <button type="button" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()} style={pill(false)}>{'📎'} Add file</button>
          </div>
        )}
      </div>
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files[0], 'photo'); e.target.value = ''; }} />
      <input ref={fileRef} type="file" hidden onChange={(e) => { upload(e.target.files[0], 'file'); e.target.value = ''; }} />
      <div style={{ display: 'flex', marginTop: 8, background: '#f4f1e8', borderRadius: 12 }}>
        <button type="button" style={tab} onClick={() => setSheet('comments')}>{'💬'} Comments{cnt(comments.length)}</button>
        <button type="button" style={tab} onClick={() => setSheet('files')}>{'📎'} Files{cnt(files.length)}</button>
        <button type="button" style={tab} onClick={() => setSheet('photos')}>{'🖼'} Photos{cnt(photos.length)}</button>
      </div>

      {cam && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#141413' }}>
          <iframe src="/scan" title="Camera" allow="camera; microphone; geolocation" style={{ width: '100%', height: '100%', border: 0 }} />
        </div>
      )}
      {sheet === 'comments' && (
        <Sheet close={() => setSheet('')} name="Comments" foot={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', borderTop: '1px solid #efece3' }}>
            <button type="button" aria-label="Add photo" onClick={() => openCam()} style={{ border: 0, background: '#f1ede4', width: 38, height: 38, borderRadius: 19, fontSize: 17, cursor: 'pointer', flex: 'none' }}>{'📷'}</button>
            <input value={chat} onChange={(e) => setChat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} placeholder="Write a comment…" enterKeyHint="send"
              style={{ flex: 1, minWidth: 0, height: 38, boxSizing: 'border-box', border: '1.5px solid #e0dccf', borderRadius: 19, padding: '0 14px', font: 'inherit', fontSize: 14, outline: 'none' }} />
            <input ref={chatPhotoRef} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files[0], 'photo', true); e.target.value = ''; }} />
          </div>
        }>
          {comments.length === 0 && <p style={{ textAlign: 'center', color: '#9a9686', fontSize: 13 }}>No comments yet.</p>}
          {comments.map((c) => {
            const mine = c.author === me;
            return (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                <div style={{ fontSize: 11.5, color: '#8a8576', margin: '0 6px 2px' }}>{c.author} {'·'} {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                <div onDoubleClick={() => (mine ? del(c.id) : null)} style={{ maxWidth: '80%', padding: c.kind === 'photo' ? 4 : '8px 12px', borderRadius: 16, background: mine ? OR : '#eeece5', color: mine ? '#fff' : '#141413', fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {c.kind === 'photo' ? <a href={url(c.pathname)} target="_blank" rel="noreferrer"><img src={url(c.pathname)} alt="" style={{ display: 'block', maxWidth: '100%', borderRadius: 12 }} /></a> : c.body}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </Sheet>
      )}
      {sheet === 'files' && (
        <Sheet close={() => setSheet('')} name="Files">
          {files.length === 0 && <p style={{ textAlign: 'center', color: '#9a9686', fontSize: 13 }}>No files yet.</p>}
          {files.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f1ede4' }}>
              <span style={{ fontSize: 20 }}>{'📎'}</span>
              <a href={url(f.pathname) + '&dl=1'} style={{ flex: 1, minWidth: 0, color: '#141413', fontSize: 14, fontWeight: 600, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}<div style={{ fontWeight: 400, fontSize: 11.5, color: '#8a8576' }}>{f.author} {'·'} {when(f.created_at)}</div></a>
              {(f.author === me) && <button type="button" onClick={() => del(f.id)} aria-label="Delete" style={{ border: 0, background: 'transparent', color: '#b0ab9a', fontSize: 16, cursor: 'pointer' }}>{'✕'}</button>}
            </div>
          ))}
          {!locked && <button type="button" disabled={busy} onClick={() => fileRef.current && fileRef.current.click()} style={{ ...pill(false), marginTop: 12 }}>{'📎'} Add file</button>}
        </Sheet>
      )}
      {sheet === 'photos' && (
        <Sheet close={() => setSheet('')} name="Photos">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <button type="button" disabled={busy} onClick={() => openCam()} style={{ aspectRatio: '1', border: '2px dashed ' + OR, borderRadius: 12, background: '#fff7ef', color: OR, font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{'＋'}<br />Add photo</button>
            {photos.map((p) => (
              <div key={p.id} style={{ position: 'relative' }}>
                <a href={url(p.pathname)} target="_blank" rel="noreferrer"><img src={url(p.pathname)} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 12, display: 'block' }} /></a>
                {p.author === me && <button type="button" onClick={() => del(p.id)} aria-label="Delete" style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, border: 0, borderRadius: 12, background: 'rgba(20,20,19,.6)', color: '#fff', cursor: 'pointer' }}>{'✕'}</button>}
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

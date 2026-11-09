'use client';
import { useState } from 'react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(j.error || 'Login failed'); setBusy(false); return; }
      const next = new URLSearchParams(location.search).get('next') || '/';
      location.href = next.startsWith('/') && !next.startsWith('//') ? next : '/';
    } catch (e2) {
      setErr(String(e2.message || e2));
      setBusy(false);
    }
  }
  const box = { width: '100%', boxSizing: 'border-box', padding: '12px', fontSize: 16, margin: '6px 0 14px' };
  return (
    <main style={{ maxWidth: 380 }}>
      <h1>Sign in</h1>
      <form onSubmit={submit}>
        <label>Username<input name="username" id="username" style={box} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus /></label>
        <label>Password<input name="password" id="password" style={box} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        <button type="submit" disabled={busy || !username || !password} style={{ padding: '12px 22px', fontSize: 16 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {err && <p className="status bad">{err}</p>}
      </form>
    </main>
  );
}

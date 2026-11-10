'use client';
import { useState } from 'react';
import Users from './Users';
import Projects from './Projects';

export default function AdminTabs() {
  const [tab, setTab] = useState('users');
  const t = (k, label) => (
    <button type="button" onClick={() => setTab(k)} aria-pressed={tab === k} style={{ padding: '9px 20px', fontSize: 15, fontWeight: 600, borderRadius: 22, border: '1px solid #cfd8dc', background: tab === k ? '#16262e' : '#fff', color: tab === k ? '#fff' : '#16262e', cursor: 'pointer' }}>{label}</button>
  );
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>{t('users', 'Users')}{t('projects', 'Projects')}</div>
      {tab === 'users' ? <Users /> : <Projects />}
    </>
  );
}

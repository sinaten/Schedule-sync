'use client';
import { useState } from 'react';
import Users from './Users';
import Projects from './Projects';
import Settings from './Settings';
import MediaRules from './MediaRules';

export default function AdminTabs({ initialTab, media }) {
  const [tab, setTab] = useState(['users', 'projects', 'media', 'settings'].includes(initialTab) ? initialTab : 'users');
  const t = (k, label) => (
    <button type="button" onClick={() => setTab(k)} aria-pressed={tab === k} style={{ padding: '9px 20px', fontSize: 15, fontWeight: 600, borderRadius: 22, border: '1px solid #cfd8dc', background: tab === k ? '#16262e' : '#fff', color: tab === k ? '#fff' : '#16262e', cursor: 'pointer' }}>{label}</button>
  );
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>{t('users', 'Users')}{t('projects', 'Projects')}{t('media', 'Photos & videos')}{t('settings', 'Settings')}</div>
      {tab === 'users' ? <Users /> : tab === 'projects' ? <Projects /> : tab === 'media' ? media : <><Settings /><div style={{ marginTop: 28 }}><MediaRules /></div></>}
    </>
  );
}

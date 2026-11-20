'use client';
import { useEffect, useState } from 'react';
import Users from './Users';
import ProjectHub from './ProjectHub';
import Workflow from './Workflow';
import DataMapping from './DataMapping';
import Settings from './Settings';
import MediaRules from './MediaRules';
import LocationRules from './LocationRules';
import Analysis from './Analysis';
import AccessRules from './AccessRules';
import UserAccess from './UserAccess';
import HistoryRules from './HistoryRules';
import UserManage from './UserManage';
import ColourRules from './ColourRules';
import FadeSettings from './FadeSettings';
import CamQrTable from './CamQrTable';
import IdFormat from './IdFormat';

export default function AdminTabs({ initialTab, media }) {
  const [tab, setTab] = useState(['users', 'projects', 'workflow', 'datamap', 'media', 'analysis', 'manage', 'settings'].includes(initialTab) ? initialTab : 'users');
  const [idn, setIdn] = useState(0);
  useEffect(() => { fetch('/api/admin/id-catalog?count=1', { cache: 'no-store' }).then((r) => r.json()).then((j) => setIdn(j.pending || 0)).catch(() => {}); }, []);
  const t = (k, label) => (
    <button type="button" onClick={() => { setTab(k); try { history.replaceState(null, '', '/admin?tab=' + k); } catch (e) {} }} aria-pressed={tab === k} style={{ padding: '9px 20px', fontSize: 15, fontWeight: 600, borderRadius: 22, border: '1px solid #cfd8dc', background: tab === k ? '#16262e' : '#fff', color: tab === k ? '#fff' : '#16262e', cursor: 'pointer' }}>{label}</button>
  );
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>{t('users', 'Users')}{t('projects', 'Projects')}{t('workflow', 'Workflow')}{t('datamap', idn > 0 ? <>Data mapping <span style={{ background: '#d64545', color: '#fff', borderRadius: 999, fontSize: 12, padding: '1px 7px', marginLeft: 4 }}>{idn}</span></> : 'Data mapping')}{t('media', 'Photos & videos')}{t('analysis', 'Analysis')}{t('manage', 'User manage')}{t('settings', 'Settings')}</div>
      {tab === 'users' ? <Users /> : tab === 'projects' ? <ProjectHub /> : tab === 'workflow' ? <Workflow /> : tab === 'datamap' ? <><DataMapping /><IdFormat /></> : tab === 'media' ? media : tab === 'analysis' ? <Analysis /> : tab === 'manage' ? <UserManage /> : <><Settings /><CamQrTable /><ColourRules /><FadeSettings /><div style={{ marginTop: 28 }}><MediaRules /></div><LocationRules /><AccessRules /><UserAccess /><HistoryRules /></>}
    </>
  );
}

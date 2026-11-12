import { db, isAddin, deny } from '../../../lib/db';
import { currentUser, canJob } from '../../../lib/user';
export const dynamic = 'force-dynamic';

// 3D model support through Autodesk Platform Services (APS).
// GET is public (read only). POST (upload) is behind the site password via middleware.js.
const BASE = 'https://developer.api.autodesk.com';
const ready = () => !!process.env.APS_CLIENT_ID && !!process.env.APS_CLIENT_SECRET;
const bucket = () => 'ss-' + process.env.APS_CLIENT_ID.toLowerCase().replace(/[^a-z0-9]/g, '');
const b64 = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function token(scope) {
  const basic = Buffer.from(process.env.APS_CLIENT_ID + ':' + process.env.APS_CLIENT_SECRET).toString('base64');
  const r = await fetch(BASE + '/authentication/v2/token', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic ' + basic },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
  });
  if (!r.ok) throw new Error('APS sign-in failed (' + r.status + '): ' + (await r.text()).slice(0, 200));
  return r.json();
}

async function api(path, t, opts = {}) {
  const r = await fetch(BASE + path, {
    cache: 'no-store',
    ...opts,
    headers: { authorization: 'Bearer ' + t.access_token, ...(opts.headers || {}) },
  });
  return r;
}

async function ensureBucket(t) {
  const r = await api('/oss/v2/buckets', t, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bucketKey: bucket(), access: 'full', policyKey: 'persistent' }),
  });
  if (!r.ok && r.status !== 409) throw new Error('Could not create storage bucket (' + r.status + '): ' + (await r.text()).slice(0, 200));
}

async function settings() {
  const sql = await db();
  await sql`create table if not exists settings(key text primary key, value jsonb)`;
  return sql;
}

export async function GET(req) {
  if (!canJob(await currentUser(), new URL(req.url).searchParams.get('job') || '')) return Response.json({ error: 'No access' }, { status: 403 });
  if (new URL(req.url).searchParams.get('look')) {
    const lj = new URL(req.url).searchParams.get('job') || '';
    const lsql = await settings();
    const [l] = await lsql`select value from settings where key=${'look:' + lj}`;
    const vw = new URL(req.url).searchParams.get('view') || '';
    if (vw) {
      // the colours of one of the offered views (falls back to the main view's)
      const [ls] = await lsql`select value from settings where key=${'looks:' + lj}`;
      const one = ls && ls.value ? ls.value[vw] : null;
      return Response.json(one || (l ? l.value : null));
    }
    return Response.json(l ? l.value : null);
  }
  if (!ready()) return Response.json({ configured: false });
  try {
    const sql = await settings();
    const job = new URL(req.url).searchParams.get('job') || ''; const [m] = await sql`select value from settings where key=${job ? 'model:' + job : 'model'}`;
    if (!m) return Response.json({ configured: true, model: null });
    const model = m.value;
    const t = await token('data:read');
    const r = await api('/modelderivative/v2/designdata/' + model.urn + '/manifest', t);
    let status = 'pending';
    let progress = '';
    if (r.ok) {
      const mf = await r.json();
      status = mf.status;
      progress = mf.progress || '';
    }
    const out = { configured: true, model: { name: model.name, urn: model.urn, status, progress, view: model.view || '', views: Array.isArray(model.views) ? model.views : [] } };
    if (status === 'success') {
      const v = await token('viewables:read');
      out.token = v.access_token;
      out.expires = v.expires_in;
    }
    return Response.json(out);
  } catch (e) {
    return Response.json({ configured: true, error: String(e.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  if (!isAddin(req)) return deny(); // models are published from Revit only
  if (!ready()) return Response.json({ error: 'APS_CLIENT_ID / APS_CLIENT_SECRET are not set in Vercel' }, { status: 400 });
  try {
    const body = await req.json();
    if (body.action === 'look') {
      const lsql = await settings();
      const lv = JSON.stringify(body.look || null);
      await lsql`insert into settings(key, value) values(${'look:' + String(body.job || '')}, ${lv}::jsonb) on conflict (key) do update set value = excluded.value`;
      if (body.looks && typeof body.looks === 'object') {
        const lk = JSON.stringify(body.looks);
        await lsql`insert into settings(key, value) values(${'looks:' + String(body.job || '')}, ${lk}::jsonb) on conflict (key) do update set value = excluded.value`;
      }
      if (Array.isArray(body.views) && body.job) {
        const vs = JSON.stringify({ views: body.views.map(String) });
        await lsql`update settings set value = value || ${vs}::jsonb where key = ${'model:' + String(body.job)}`;
      }
      return Response.json({ ok: true });
    }
    const t = await token('bucket:create bucket:read data:read data:write data:create');

    if (body.action === 'start') {
      await ensureBucket(t);
      const key = Date.now() + '-' + String(body.name || 'model.rvt').replace(/[^A-Za-z0-9._-]/g, '_');
      const parts = Math.max(1, Math.min(Number(body.parts) || 1, 200));
      const r = await api(
        '/oss/v2/buckets/' + bucket() + '/objects/' + encodeURIComponent(key) + '/signeds3upload?parts=' + parts + '&firstPart=1&minutesExpiration=60',
        t
      );
      if (!r.ok) throw new Error('Could not get upload address (' + r.status + '): ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      return Response.json({ key, uploadKey: j.uploadKey, urls: j.urls });
    }

    if (body.action === 'finish') {
      const done = await api('/oss/v2/buckets/' + bucket() + '/objects/' + encodeURIComponent(body.key) + '/signeds3upload', t, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uploadKey: body.uploadKey }),
      });
      if (!done.ok) throw new Error('Could not finish upload (' + done.status + '): ' + (await done.text()).slice(0, 200));
      const obj = await done.json();
      const urn = b64(obj.objectId);
      const job = await api('/modelderivative/v2/designdata/job', t, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-ads-force': 'true' },
        body: JSON.stringify({ input: { urn }, output: { formats: [{ type: 'svf2', views: ['2d', '3d'], advanced: { generateMasterViews: true } }] } }),
      });
      if (!job.ok) throw new Error('Could not start conversion (' + job.status + '): ' + (await job.text()).slice(0, 300));
      const sql = await settings();
      const value = JSON.stringify({ urn, name: body.name || 'Model', uploadedAt: new Date().toISOString(), view: String(body.view || ''), views: Array.isArray(body.views) ? body.views.map(String) : [] });
      await sql`insert into settings(key, value) values(${body.job ? 'model:' + body.job : 'model'}, ${value}::jsonb) on conflict (key) do update set value = excluded.value`;
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return Response.json({ error: String(e.message || e) }, { status: 500 });
  }
}

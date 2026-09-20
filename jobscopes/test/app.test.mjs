import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createApp } from '../workspace.mjs';

const projectInput = { name: 'Back deck renovation', client: 'Test homeowner', address: 'Ashtabula, OH', type: 'Deck', status: 'Discovery', notes: 'Replace decking and inspect existing conditions.' };
const discoveryInput = { title: 'Moisture near ledger', description: 'Discoloration behind old trim.', category: 'Moisture', priority: 'High', status: 'Open', next_step: 'Document flashing and arrange review.', photo_id: null };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');

test('projects, photos, and Discovery Log survive a server restart; validation and isolation hold', async t => {
  const dataDir = mkdtempSync(join(tmpdir(), 'contractoros-test-'));
  let server, base;
  async function start() { server = createApp({ dataDir }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`; }
  async function stop() { await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
  t.after(async () => { if (server?.listening) await stop(); rmSync(dataDir, { recursive: true, force: true }); });
  const get = async path => { const r = await fetch(base + path); assert.equal(r.status, 200); return r.json(); };
  const send = async (path, method, value, status = 200) => { const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }); const b = await r.json(); assert.equal(r.status, status, JSON.stringify(b)); return b; };
  await start();
  await t.test('fresh workspace and static assets', async () => {
    assert.deepEqual(await get('/api/projects'), []);
    for (const path of ['/', '/app.js', '/style.css', '/icon.svg']) { const r = await fetch(base + path); assert.equal(r.status, 200); assert.ok(r.headers.get('content-security-policy')); }
    assert.equal((await fetch(base + '/server.mjs')).status, 404);
    assert.equal((await fetch(base + '/data/contractoros.sqlite')).status, 404);
  });
  let p, other, photo, discovery;
  await t.test('create and edit, with stale-write protection', async () => {
    p = await send('/api/projects', 'POST', projectInput, 201);
    other = await send('/api/projects', 'POST', { ...projectInput, name: 'Kitchen' }, 201);
    p = await send(`/api/projects/${p.id}`, 'PUT', { ...p, name: 'Back deck rebuild', status: 'Planning' });
    assert.equal(p.revision, 2);
    await send(`/api/projects/${p.id}`, 'PUT', { ...p, revision: 1 }, 409);
    await send('/api/projects', 'POST', { ...projectInput, name: '   ' }, 400);
    await send('/api/projects', 'POST', { ...projectInput, type: 'Unknown' }, 400);
    await send('/api/projects', 'POST', { ...projectInput, name: 'x'.repeat(121) }, 400);
    assert.equal((await fetch(base + '/api/projects/missing')).status, 404);
    const malformed = await fetch(base + '/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
  });
  await t.test('photo bytes persist and unsafe formats are rejected', async () => {
    let r = await fetch(base + `/api/projects/${p.id}/photos?name=ledger.png`, { method: 'POST', body: png });
    assert.equal(r.status, 201); photo = await r.json();
    r = await fetch(base + `/api/photos/${photo.id}`); assert.equal(r.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), png);
    r = await fetch(base + `/api/projects/${p.id}/photos`, { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: '<svg onload="alert(1)"/>' }); assert.equal(r.status, 415);
    r = await fetch(base + `/api/projects/${p.id}/photos`, { method: 'POST', body: Buffer.alloc(15 * 1024 * 1024 + 1) }); assert.equal(r.status, 413);
    r = await fetch(base + '/api/projects/missing/photos', { method: 'POST', body: png }); assert.equal(r.status, 404);
  });
  await t.test('discovery photo ownership, editing and resolution', async () => {
    discovery = await send(`/api/projects/${p.id}/discoveries`, 'POST', { ...discoveryInput, photo_id: photo.id }, 201);
    await send(`/api/projects/${other.id}/discoveries`, 'POST', { ...discoveryInput, photo_id: photo.id }, 400);
    await send(`/api/projects/${other.id}/discoveries/${discovery.id}`, 'PUT', discovery, 404);
    await send(`/api/projects/${p.id}/discoveries`, 'POST', { ...discoveryInput, priority: 'Urgent' }, 400);
    assert.equal((await get('/api/projects')).find(x => x.id === p.id).open_count, 1);
    discovery = await send(`/api/projects/${p.id}/discoveries/${discovery.id}`, 'PUT', { ...discovery, status: 'Resolved', next_step: 'Review completed; flashing replacement documented.' });
    await send(`/api/projects/${p.id}/discoveries/${discovery.id}`, 'PUT', { ...discovery, revision: 1 }, 409);
    assert.equal((await get('/api/projects')).find(x => x.id === p.id).open_count, 0);
  });
  await t.test('cross-origin changes are blocked', async () => {
    const r = await fetch(base + '/api/projects', { method: 'POST', headers: { Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: JSON.stringify(projectInput) }); assert.equal(r.status, 403);
  });
  await t.test('restart retains project changes, original photos and resolved entries', async () => {
    await stop(); await start();
    const saved = await get(`/api/projects/${p.id}`);
    assert.equal(saved.name, 'Back deck rebuild'); assert.equal(saved.status, 'Planning');
    assert.equal(saved.photos[0].id, photo.id); assert.equal(saved.discoveries[0].status, 'Resolved');
    assert.equal(saved.discoveries[0].photo_id, photo.id);
    assert.deepEqual(Buffer.from(await (await fetch(base + `/api/photos/${photo.id}`)).arrayBuffer()), png);
    const isolated = await get(`/api/projects/${other.id}`); assert.deepEqual(isolated.photos, []); assert.deepEqual(isolated.discoveries, []);
  });
});

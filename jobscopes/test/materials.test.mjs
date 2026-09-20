import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../workspace.mjs';

test('materials workflow: missing costs, money, snapshots, isolation and persistence', async t => {
  const dataDir = mkdtempSync(join(tmpdir(), 'jobscopes-materials-'));
  let server, base, estimate, other;
  async function start() { server = createApp({ dataDir }); server.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`; }
  async function stop() { await new Promise(resolve => server.close(resolve)); }
  t.after(async () => { if (server?.listening) await stop(); rmSync(dataDir, { recursive: true, force: true }); });
  async function request(path, method = 'GET', value, status = 200) {
    const r = await fetch(base + path, { method, ...(value === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) }) });
    const result = await r.json(); assert.equal(r.status, status, JSON.stringify(result)); return result;
  }
  const input = { name: 'Basement test', type: 'Basement', status: 'Discovery', notes: 'Original notes stay here' };
  await start();
  const project = await request('/api/projects', 'POST', input, 201);
  const second = await request('/api/projects', 'POST', { ...input, name: 'Separate project' }, 201);
  const path = `/api/projects/${project.id}/estimate`, otherPath = `/api/projects/${second.id}/estimate`;
  let firstId, snapshotId, frozen;
  await t.test('suggestions are idempotent and start unknown, not free', async () => {
    estimate = await request(path + '/seed', 'POST', { modules: ['basement', 'music', 'bathroom', 'costs'] }, 201);
    assert.equal(estimate.items.length, 35); assert.equal(estimate.totals.total_cents, 0);
    assert.ok(estimate.items.every(i => i.quantity === null && i.unit_cents === null && i.status === 'Suggested'));
    assert.ok(estimate.checks.some(c => c.title.includes('furnace')));
    const repeated = await request(path + '/seed', 'POST', { modules: ['basement', 'music', 'bathroom', 'costs', 'music'] }, 201);
    assert.equal(repeated.items.length, 35); assert.equal(repeated.token, estimate.token);
    assert.ok(estimate.flags.some(f => f.message.includes('Needs quantity')));
    await request(path + '/seed', 'POST', { modules: ['constructor'] }, 400);
    await request(path + '/seed', 'POST', { modules: [] }, 400);
  });
  const itemBody = item => ({ ...item, unit_price: item.unit_cents === null ? null : item.unit_cents / 100 });
  await t.test('inclusive totals, decimal rounding, waste and separate costs', async () => {
    const first = estimate.items[0]; firstId = first.id;
    estimate = await request(`${path}/items/${first.id}`, 'PUT', { ...itemBody(first), quantity: '10', waste: '10', unit_price: '2.50', status: 'Included', price_source: 'Supplier quote', price_date: '2026-09-20' });
    assert.equal(estimate.totals.material_cents, 2750);
    const labor = estimate.items.find(i => i.kind === 'Labor');
    estimate = await request(`${path}/items/${labor.id}`, 'PUT', { ...itemBody(labor), quantity: '2.5', waste: '50', unit_price: '40', status: 'Included', price_source: 'Own labor rate', price_date: '2026-09-20' });
    assert.equal(estimate.totals.labor_cents, 10000); assert.equal(estimate.totals.total_cents, 12750);
    estimate = await request(path + '/items', 'POST', { ...itemBody(first), name: 'Half-cent rounding', quantity: '0.145', waste: '0', unit_price: '1', status: 'Included' }, 201);
    assert.equal(estimate.items.find(i => i.name === 'Half-cent rounding').total_cents, 15);
    estimate = await request(path + '/items', 'POST', { ...itemBody(first), name: 'Unknown price', quantity: 5, waste: 0, unit_price: '', status: 'Included' }, 201);
    assert.equal(estimate.items.find(i => i.name === 'Unknown price').total_cents, null);
    assert.equal(estimate.totals.total_cents, 12765);
    estimate = await request(path + '/seed', 'POST', { modules: ['basement'] }, 201);
    assert.equal(estimate.items.find(i => i.id === firstId).quantity, 10);
  });
  await t.test('reject invalid numeric values, stale edits and cross-project IDs', async () => {
    const first = estimate.items.find(i => i.id === firstId), b = itemBody(first);
    for (const value of [-1, 'NaN', 'Infinity', '1e5', true, [], ' ', '1.2345']) await request(`${path}/items/${firstId}`, 'PUT', { ...b, quantity: value }, 400);
    await request(`${path}/items/${firstId}`, 'PUT', { ...b, unit_price: '1.001' }, 400);
    await request(`${path}/items/${firstId}`, 'PUT', { ...b, waste: 101 }, 400);
    await request(`${path}/items/${firstId}`, 'PUT', { ...b, price_date: '2026-02-30' }, 400);
    await request(`${path}/items/${firstId}`, 'PUT', { ...b, revision: 1 }, 409);
    await request(`${otherPath}/items/${firstId}`, 'PUT', b, 404);
    await request(`${path}/items/${firstId}`, 'PUT', { ...b, status: 'Excluded', exclusion_reason: '' }, 400);
    const zero = await request(path + '/items', 'POST', { ...b, name: 'Zero cost unreviewed', quantity: 1, waste: 0, unit_price: 0, notes: '' }, 201);
    assert.ok(zero.items.find(i => i.name === 'Zero cost unreviewed').flags.includes('Explain zero cost in notes'));
    estimate = zero;
  });
  await t.test('review notes and scope are persisted with revision checks', async () => {
    estimate = await request(path + '/context', 'PUT', { notes: 'Music room 15 × 10 ft. Joists 83 in; low duct 74.5 in. Bathroom locations unchanged.', revision: 0 });
    await request(path + '/context', 'PUT', { notes: 'Stale edit', revision: 0 }, 409);
    const check = estimate.checks[0];
    await request(`${path}/checks/${check.id}`, 'PUT', { resolved: true, notes: '', revision: check.revision }, 400);
    estimate = await request(`${path}/checks/${check.id}`, 'PUT', { resolved: true, notes: 'Measured the area; quantities still need entry.', revision: check.revision });
    await request(`${path}/checks/${check.id}`, 'PUT', { resolved: false, notes: '', revision: check.revision }, 409);
    await request(`${otherPath}/checks/${check.id}`, 'PUT', { resolved: true, notes: 'Wrong project', revision: 1 }, 404);
    const discovery = await request(`/api/projects/${project.id}/discoveries`, 'POST', { title: 'Inspect concealed moisture', category: 'Moisture', priority: 'High', status: 'Open' }, 201);
    estimate = await request(path);
    assert.ok(estimate.flags.some(f => f.discovery_id === discovery.id));
  });
  await t.test('markup is explicit, rounded and distinguishes margin from markup', async () => {
    assert.equal(estimate.pricing.markup, null); assert.equal(estimate.selling_cents, null);
    await request(path + '/pricing', 'PUT', { markup: -1, revision: 0 }, 400);
    await request(path + '/pricing', 'PUT', { markup: 501, revision: 0 }, 400);
    estimate = await request(path + '/pricing', 'PUT', { markup: '25', notes: 'Cover overhead and profit', revision: 0 });
    assert.equal(estimate.markup_cents, 3191); assert.equal(estimate.selling_cents, 15956);
    assert.ok(Math.abs(estimate.gross_margin - 20) < 0.01);
    await request(path + '/pricing', 'PUT', { markup: 30, revision: 0 }, 409);
    const other = await request(otherPath); assert.equal(other.pricing.markup, null);
  });
  await t.test('immutable snapshots preserve incomplete costs and detect later changes', async () => {
    await request(path + '/snapshots', 'POST', { label: 'Stale', token: 'wrong' }, 409);
    estimate = await request(path + '/snapshots', 'POST', { label: 'First estimate', token: estimate.token }, 201);
    snapshotId = estimate.snapshots[0].id;
    frozen = await request(`${path}/snapshots/${snapshotId}`);
    assert.ok(frozen.content.flags.length > 0); assert.equal(estimate.changed_since_snapshot, false);
    assert.equal(frozen.content.totals.total_cents, 12765);
    assert.equal(frozen.content.pricing.markup, 25); assert.equal(frozen.content.selling_cents, 15956);
    const first = estimate.items.find(i => i.id === firstId);
    estimate = await request(`${path}/items/${firstId}`, 'PUT', { ...itemBody(first), status: 'Excluded', exclusion_reason: 'Already covered in another assembly.' });
    assert.equal(estimate.totals.total_cents, 10015); assert.equal(estimate.delta_cents, -2750); assert.equal(estimate.changed_since_snapshot, true);
    assert.deepEqual(await request(`${path}/snapshots/${snapshotId}`), frozen);
    estimate = await request(path + '/pricing', 'PUT', { markup: 0, notes: 'Explicit no markup', revision: estimate.pricing.revision });
    assert.equal(estimate.selling_cents, estimate.totals.total_cents); assert.equal(estimate.gross_margin, 0);
    assert.equal((await request(`${path}/snapshots/${snapshotId}`)).content.pricing.markup, 25);
    await request(`${otherPath}/snapshots/${snapshotId}`, 'GET', undefined, 404);
    other = await request(otherPath); assert.equal(other.items.length, 0); assert.equal(other.snapshots.length, 0);
  });
  await t.test('restart preserves estimates without changing existing projects', async () => {
    await stop(); await start();
    const restored = await request(path);
    assert.equal(restored.token, estimate.token); assert.deepEqual(await request(`${path}/snapshots/${snapshotId}`), frozen);
    const p = await request(`/api/projects/${project.id}`); assert.equal(p.notes, input.notes);
    assert.equal(p.discoveries.length, 1);
    const db = new DatabaseSync(join(dataDir, 'contractoros.sqlite')); assert.ok(db.prepare('PRAGMA user_version').get().user_version >= 3); assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); db.close();
  });
});

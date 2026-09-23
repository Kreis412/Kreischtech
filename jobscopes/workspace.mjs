import { measurementStore } from './measurements.mjs';
import { equipmentStore } from './equipment.mjs';
import { joeStore } from './joe.mjs';
import { analysisStore } from './analysis.mjs';
import { operationsStore } from './operations.mjs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { materialsStore } from './materials.mjs';
import { companyStore } from './company.mjs';
import { guardLocalRequest, exportBackup } from './security.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
export const TYPES = ['Basement', 'Kitchen', 'Bathroom', 'Deck', 'Outdoor', 'General remodeling'];
export const STATUSES = ['Discovery', 'Planning', 'In progress', 'On hold', 'Complete'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const CATEGORIES = ['General', 'Structure', 'Moisture', 'Electrical', 'Plumbing', 'Materials', 'Site conditions'];
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const text = (v, label, max = 4000, required = false) => {
  if (typeof v !== 'string' || v.trim().length > max || (required && !v.trim())) fail(400, `${label} ${required ? 'is required and ' : ''}must be text of at most ${max} characters.`);
  return v.trim();
};
const choice = (v, options, label) => options.includes(v) ? v : fail(400, `Choose a valid ${label}.`);
async function body(req, max) {
  if (Number(req.headers['content-length']) > max) fail(413, 'File or request is too large. Photos must be 15 MB or smaller.');
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > max) fail(413, 'Request is too large.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
async function json(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'Expected JSON.');
  try { const value = JSON.parse((await body(req, 65536)).toString()); if (!value || Array.isArray(value) || typeof value !== 'object') fail(400, 'Expected an object.'); return value; }
  catch (e) { if (e.status) throw e; fail(400, 'Invalid JSON.'); }
}
function imageType(bytes) {
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  fail(415, 'Choose a JPEG, PNG, or WebP photo. Export HEIC photos as JPEG first.');
}

export function createApp({ dataDir = process.env.DATA_DIR || join(ROOT, 'data'), cloud = null, requestGuard = guardLocalRequest } = {}) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(join(dataDir, 'contractoros.sqlite'));
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, client TEXT NOT NULL, address TEXT NOT NULL,
      type TEXT NOT NULL, status TEXT NOT NULL, notes TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL,
      mime TEXT NOT NULL, content BLOB NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS discoveries (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL,
      description TEXT NOT NULL, category TEXT NOT NULL, priority TEXT NOT NULL,
      status TEXT NOT NULL, next_step TEXT NOT NULL, photo_id TEXT REFERENCES photos(id),
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1);
    `);
  const estimates = materialsStore(db);
  const company = companyStore(db, estimates);
  const equipment = equipmentStore(db);
  const operations = operationsStore(db, estimates);
  const measurements = measurementStore(db);
  const analysis = analysisStore(db,{cloud,measurements});
  const joe = joeStore(db,{measurements});
  let backupRunning = false;
  const project = id => db.prepare('SELECT * FROM projects WHERE id = ?').get(id) || fail(404, 'Project not found.');
  const photos = id => db.prepare('SELECT id, project_id, name, mime, created_at FROM photos WHERE project_id = ? ORDER BY created_at DESC').all(id);
  const discoveries = id => db.prepare('SELECT * FROM discoveries WHERE project_id = ? ORDER BY created_at DESC').all(id);
  const detail = id => ({ ...project(id), photos: photos(id), discoveries: discoveries(id) });
  const server = createServer(async (req, res) => {
    const send = (status, data, type = 'application/json') => {
      res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
      res.end(type === 'application/json' ? JSON.stringify(data) : data);
    };
    try {
      const url = new URL(req.url, 'http://localhost'); const path = url.pathname;
      requestGuard(req);
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) fail(403, 'Cross-origin requests are not allowed.');
      if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Cross-site requests are not allowed.');
      if (req.method === 'GET' && path === '/api/security') return send(200, { access:'This computer only', authentication:false, storageEncrypted:false, encryptedBackups:true });
      if (req.method === 'POST' && path === '/api/security/backup') {
        if (backupRunning) fail(429, 'A backup is already being prepared. Please wait.');
        backupRunning = true;
        try {
          const b = await json(req);
          const encrypted = await exportBackup(db, resolve(dataDir), b.password);
          res.setHeader('Content-Disposition', 'attachment; filename="ContractorSight-backup.jobscopes"');
          return send(200, encrypted, 'application/octet-stream');
        } finally { backupRunning = false; }
      }
      if (await measurements.handle(req,url,project,json,send)) return;
      if (await joe.handle(req,url,project,json,send)) return;
      if (await analysis.handle(req, url, project, json, send)) return;
      if (await equipment.handle(req, url, project, json, send)) return;
      if (await operations.handle(req, url, project, json, send)) return;
      if (await company.handle(req, url, json, send)) return;
      if (await estimates.handle(req, path, project, json, send)) return;
      if (req.method === 'GET' && path === '/api/projects') {
        return send(200, db.prepare(`SELECT p.*,
          (SELECT count(*) FROM photos WHERE project_id=p.id) photo_count,
          (SELECT count(*) FROM discoveries WHERE project_id=p.id AND status='Open') open_count
          FROM projects p ORDER BY updated_at DESC`).all());
      }
      if (req.method === 'POST' && path === '/api/projects') {
        const b = await json(req); const id = randomUUID(), now = new Date().toISOString();
        db.prepare('INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').run(id,
          text(b.name, 'Project name', 120, true), text(b.client ?? '', 'Client', 160), text(b.address ?? '', 'Address', 300),
          choice(b.type, TYPES, 'project type'), choice(b.status, STATUSES, 'status'), text(b.notes ?? '', 'Notes'), now, now);
        return send(201, detail(id));
      }
      let match = path.match(/^\/api\/projects\/([\w-]+)$/);
      if (match) {
        const id = match[1]; project(id);
        if (req.method === 'GET') return send(200, detail(id));
        if (req.method === 'PUT') {
          const b = await json(req);
          const result = db.prepare('UPDATE projects SET name=?, client=?, address=?, type=?, status=?, notes=?, updated_at=?, revision=revision+1 WHERE id=? AND revision=?').run(
            text(b.name, 'Project name', 120, true), text(b.client ?? '', 'Client', 160), text(b.address ?? '', 'Address', 300),
            choice(b.type, TYPES, 'project type'), choice(b.status, STATUSES, 'status'), text(b.notes ?? '', 'Notes'), new Date().toISOString(), id, Number(b.revision) || 0);
          if (!result.changes) fail(409, 'This project changed on another screen. Close this form, refresh, and try again.');
          return send(200, detail(id));
        }
      }
      match = path.match(/^\/api\/projects\/([\w-]+)\/photos$/);
      if (match && req.method === 'POST') {
        const id = match[1]; project(id);
        const bytes = await body(req, 15 * 1024 * 1024); const mime = imageType(bytes);
        const name = text(url.searchParams.get('name') || 'Site photo', 'Photo name', 240, true);
        const photoId = randomUUID(), now = new Date().toISOString();
        db.prepare('INSERT INTO photos VALUES (?, ?, ?, ?, ?, ?)').run(photoId, id, name, mime, bytes, now);
        return send(201, { id: photoId, project_id: id, name, mime, created_at: now });
      }
      match = path.match(/^\/api\/photos\/([\w-]+)$/);
      if (match && req.method === 'GET') {
        const photo = db.prepare('SELECT mime, content FROM photos WHERE id=?').get(match[1]) || fail(404, 'Photo not found.');
        return send(200, Buffer.from(photo.content), photo.mime);
      }
      match = path.match(/^\/api\/projects\/([\w-]+)\/discoveries(?:\/([\w-]+))?$/);
      if (match && (req.method === 'POST' || req.method === 'PUT')) {
        const [, projectId, existingId] = match; project(projectId);
        if ((req.method === 'PUT') !== Boolean(existingId)) fail(405, 'Method not allowed.');
        if (existingId && !db.prepare('SELECT id FROM discoveries WHERE id=? AND project_id=?').get(existingId, projectId)) fail(404, 'Discovery not found.');
        const b = await json(req), id = existingId || randomUUID(), now = new Date().toISOString();
        const photoId = b.photo_id || null;
        if (photoId && (typeof photoId !== 'string' || !db.prepare('SELECT id FROM photos WHERE id=? AND project_id=?').get(photoId, projectId))) fail(400, 'Choose a photo from this project.');
        const values = [text(b.title, 'Discovery title', 160, true), text(b.description ?? '', 'Description'), choice(b.category, CATEGORIES, 'category'), choice(b.priority, PRIORITIES, 'priority'), choice(b.status, ['Open', 'Resolved'], 'status'), text(b.next_step ?? '', 'Next step', 2000), photoId];
        if (existingId) {
          const result = db.prepare('UPDATE discoveries SET title=?, description=?, category=?, priority=?, status=?, next_step=?, photo_id=?, updated_at=?, revision=revision+1 WHERE id=? AND project_id=? AND revision=?').run(...values, now, id, projectId, Number(b.revision) || 0);
          if (!result.changes) fail(409, 'This discovery changed on another screen. Close this form, refresh, and try again.');
        } else db.prepare('INSERT INTO discoveries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)').run(id, projectId, ...values, now, now);
        return send(existingId ? 200 : 201, db.prepare('SELECT * FROM discoveries WHERE id=?').get(id));
      }
      const staticFiles = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/materials.js': ['materials.js', 'text/javascript; charset=utf-8'], '/company.js': ['company.js', 'text/javascript; charset=utf-8'], '/security.js': ['security.js', 'text/javascript; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'], '/icon.svg': ['icon.svg', 'image/svg+xml'] };
      if (req.method === 'GET' && staticFiles[path]) {
        const [file, type] = staticFiles[path]; return send(200, readFileSync(join(ROOT, 'public', file)), type);
      }
      fail(404, 'Not found.');
    } catch (e) { if (!e.status) console.error(e); if (!res.headersSent) send(e.status || 500, { error: e.status ? e.message : 'Could not save or load data. Please try again.' }); }
  });
  server.on('close', () => db.close());
  server.requestTimeout = 120000;
  return server;
}
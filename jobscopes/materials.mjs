import { randomUUID, createHash } from 'node:crypto';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const text = (v, name, max = 2000, required = false) => {
  if (typeof v !== 'string' || v.trim().length > max || (required && !v.trim())) fail(400, `Enter ${name}${required ? ' (required)' : ''}, at most ${max} characters.`);
  return v.trim();
};
function decimal(v, name, max, places) {
  if (v === null || v === '' || v === undefined) return null;
  if (!['number', 'string'].includes(typeof v) || !/^\d+(\.\d+)?$/.test(String(v))) fail(400, `${name} must be a nonnegative number or blank.`);
  const n = Number(v), factor = 10 ** places;
  if (!Number.isFinite(n) || n > max || Math.abs(n * factor - Math.round(n * factor)) > 0.00001) fail(400, `${name} is too large or has too many decimal places.`);
  return n;
}
const choose = (v, choices, name) => choices.includes(v) ? v : fail(400, `Choose a valid ${name}.`);
const sections = ['Basement finishing', 'Music room', 'Bathroom', 'Kitchen', 'Deck / outdoor', 'General work', 'Project costs'];
const kinds = ['Material', 'Labor', 'Other cost'];
const units = ['each', 'sq ft', 'linear ft', 'sheet', 'bag', 'box', 'roll', 'tube', 'gallon', 'hour', 'day', 'allowance'];
function lineCents(item) {
  const quantity = BigInt(Math.round(item.quantity * 1000));
  const wasteFactor = 10000n + BigInt(Math.round((item.kind === 'Material' ? item.waste : 0) * 100));
  return Number((quantity * wasteFactor * BigInt(item.unit_cents) + 5000000n) / 10000000n);
}

// These are editable scope prompts, not construction specifications or automatic takeoffs.
const templates = {
  basement: { label: 'Basement finishing', section: 'Basement finishing', items: [
    ['Wall framing and backing', 'linear ft', 'Confirm wall layout and backing locations.'],
    ['Insulation / moisture-control assembly', 'sq ft', 'Select after reviewing existing moisture and wall conditions.'],
    ['Wall and ceiling finish boards', 'sheet', 'Measure actual surfaces and select the assembly before counting sheets.'],
    ['Fasteners and anchors', 'box', 'Match fasteners to each selected assembly.'],
    ['Joint tape, compound and corner bead', 'allowance', 'Split into separate purchase items when products are selected.'],
    ['Primer and paint', 'gallon', 'Confirm coverage, coats and surfaces.'],
    ['Flooring and compatible preparation materials', 'sq ft', 'Confirm floor condition and finished-height impact.'],
    ['Baseboard, trim and transitions', 'linear ft', 'Include corners, door transitions and finishing supplies.'],
    ['Lighting, outlets and installation supplies', 'allowance', 'Confirm layout and electrical scope.'],
    ['Dust protection, masking and cleanup supplies', 'allowance', 'Include occupied-home protection.']
  ], checks: ['Measure the whole basement and confirm finished areas', 'Review moisture and concealed wall conditions', 'Confirm finished ceiling height and low obstructions'] },
  music: { label: 'Music room', section: 'Music room', items: [
    ['Divider framing and backing', 'linear ft', 'Confirm divider, doorway and furnace service area first.'],
    ['Selected sound-isolation wall / ceiling materials', 'allowance', 'Assembly not selected. Do not count generic insulation as a complete sound-isolation system.'],
    ['Cavity insulation for selected assembly', 'sq ft', 'Confirm assembly, thickness and area before purchasing.'],
    ['Acoustic sealant and perimeter details', 'tube', 'Review joints and penetrations for the selected assembly.'],
    ['Door, frame, hardware and acoustic seals', 'each', 'Include threshold/drop seal if selected; confirm access needs.'],
    ['Interior acoustic panels and mounting hardware', 'each', 'For sound inside the room; separate from sound isolation.'],
    ['Floor finish / drum rug', 'sq ft', 'Confirm coverage and height; do not assume a raised floor.'],
    ['Lighting and outlet materials', 'allowance', 'Plan instrument, amplifier and general-use locations.'],
    ['Quiet ventilation provisions', 'allowance', 'Review comfort and sound paths with HVAC scope.'],
    ['Assembly fasteners, tape and finishing supplies', 'allowance', 'Check supporting materials against the selected assemblies.']
  ], checks: ['Confirm music-room layout, doorway and measurements', 'Verify furnace airflow, venting and service access before divider work', 'Review low duct and finished headroom before selecting ceiling details', 'Confirm fireplace treatment and requirements before future use', 'Select sound isolation and acoustic treatment within budget'] },
  bathroom: { label: 'Bathroom remodel', section: 'Bathroom', items: [
    ['Replacement fixtures and trim', 'allowance', 'Identify what is reused versus replaced; locations can remain unchanged.'],
    ['Supply connectors, shutoffs and drain fittings', 'allowance', 'Existing locations do not establish the condition of connections.'],
    ['Substrate and selected waterproofing system', 'sq ft', 'Confirm wet areas and compatible components.'],
    ['Tile / wall finishes and flooring', 'sq ft', 'Measure separately and split by product as selections are made.'],
    ['Mortar, grout, sealants and accessories', 'allowance', 'Include edges, corners and penetrations as applicable.'],
    ['Ventilation fan and duct components', 'allowance', 'Confirm existing arrangement and replacement scope.'],
    ['Lighting, electrical accessories and mirror', 'allowance', 'Confirm reuse or replacement.'],
    ['Paint, trim and installation fasteners', 'allowance', 'Include small finishing items.']
  ], checks: ['Confirm bathroom measurements and fixture reuse / replacement', 'Inspect existing plumbing connections and ventilation', 'Confirm wet-area finish and waterproofing scope'] },
  kitchen: { label: 'Kitchen', section: 'Kitchen', items: [
    ['Cabinets, fillers and hardware', 'allowance', 'Confirm layout and selections.'], ['Counters and backsplash', 'sq ft', 'Measure and confirm cutouts.'], ['Plumbing fixtures and connections', 'allowance', 'Confirm reuse and relocation scope.'], ['Floor and wall finishes', 'sq ft', 'Confirm preparation and coverage.'], ['Lighting and electrical materials', 'allowance', 'Confirm appliance and lighting scope.'], ['Fasteners, adhesives, trim and sealants', 'allowance', 'Check supporting items against selections.']
  ], checks: ['Confirm kitchen measurements, selections and service changes'] },
  outdoor: { label: 'Deck / outdoor', section: 'Deck / outdoor', items: [
    ['Framing and surface materials', 'allowance', 'Confirm design, quantities and exposure requirements.'], ['Footing / base materials', 'allowance', 'Confirm approved project design and site conditions.'], ['Connectors, anchors and fasteners', 'allowance', 'Match selected design and material compatibility.'], ['Flashing and water-management materials', 'allowance', 'Confirm applicable connections.'], ['Guard, stair and handrail components', 'allowance', 'Confirm design and applicability.'], ['Finish and cleanup supplies', 'allowance', 'Confirm selected products and coverage.']
  ], checks: ['Confirm outdoor dimensions, site conditions and applicable design approvals'] },
  general: { label: 'General remodeling', section: 'General work', items: [
    ['Main materials for confirmed scope', 'allowance', 'Split by product after scope review.'], ['Preparation and repair materials', 'allowance', 'Confirm existing conditions.'], ['Fasteners, adhesives and sealants', 'allowance', 'Include assembly-specific accessories.'], ['Trim, finishes and protection', 'allowance', 'Confirm quantities and selections.']
  ], checks: ['Confirm scope, measurements and selections'] },
  costs: { label: 'Labor and project costs', section: 'Project costs', items: [
    ['Labor', 'hour', 'Break out demolition, installation and finishing as needed.', 'Labor'],
    ['Delivery / freight', 'allowance', 'Include each supplier delivery.', 'Other cost'],
    ['Disposal / hauling', 'allowance', 'Include demolition and packaging.', 'Other cost'],
    ['Equipment rental', 'day', 'Include rental duration and delivery.', 'Other cost'],
    ['Permits / inspections / specialist reviews', 'allowance', 'Confirm applicability and actual fees.', 'Other cost'],
    ['Taxes', 'allowance', 'Enter confirmed applicable tax cost; not automatically calculated.', 'Other cost'],
    ['Contingency allowance', 'allowance', 'Decide an explicit allowance; unresolved work still needs review.', 'Other cost']
  ], checks: ['Review scope boundaries, exclusions and any overlapping allowances'] }
};

export function materialsStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS material_items (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), section TEXT NOT NULL,
    name TEXT NOT NULL, kind TEXT NOT NULL, unit TEXT NOT NULL, quantity REAL, waste REAL, unit_cents INTEGER,
    status TEXT NOT NULL, notes TEXT NOT NULL, exclusion_reason TEXT NOT NULL, price_source TEXT NOT NULL,
    price_date TEXT NOT NULL, template_key TEXT, revision INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(project_id, template_key));
    CREATE TABLE IF NOT EXISTS estimate_checks (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '', resolved INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1,
    template_key TEXT, UNIQUE(project_id, template_key));
    CREATE TABLE IF NOT EXISTS estimate_context (
    project_id TEXT PRIMARY KEY REFERENCES projects(id), notes TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS estimate_snapshots (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), label TEXT NOT NULL,
    created_at TEXT NOT NULL, content TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS estimate_pricing (
    project_id TEXT PRIMARY KEY REFERENCES projects(id), markup REAL, notes TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1);
    PRAGMA user_version = 3;`);
  function state(projectId) {
    const items = db.prepare('SELECT * FROM material_items WHERE project_id=? ORDER BY rowid').all(projectId).map(item => {
      // Quantity × waste-adjusted factor × price in cents, rounded per line. No hidden pack rounding.
      const total_cents = item.status === 'Included' && item.quantity !== null && item.unit_cents !== null && (item.kind !== 'Material' || item.waste !== null)
        ? lineCents(item) : null;
      return { ...item, total_cents };
    });
    const checks = db.prepare('SELECT * FROM estimate_checks WHERE project_id=? ORDER BY rowid').all(projectId);
    const context = db.prepare('SELECT * FROM estimate_context WHERE project_id=?').get(projectId) || { notes: '', revision: 0 };
    const discoveries = db.prepare("SELECT id, title FROM discoveries WHERE project_id=? AND status='Open' ORDER BY id").all(projectId);
    const flags = [];
    const pricing = db.prepare('SELECT * FROM estimate_pricing WHERE project_id=?').get(projectId) || { markup: null, notes: '', revision: 0 };
    if (pricing.markup === null) flags.push({ message: 'Choose a markup, or explicitly enter 0%.' });
    if (!items.some(i => i.status === 'Included')) flags.push({ message: 'No included items yet.' });
    const totals = { material_cents: 0, labor_cents: 0, other_cents: 0, total_cents: 0, priced_count: 0 };
    for (const item of items) {
      const missing = [];
      if (item.status === 'Suggested') missing.push('Review suggestion');
      if (item.status !== 'Excluded') {
        if (item.quantity === null) missing.push('Needs quantity');
        else if (item.quantity === 0) missing.push('Quantity is zero — enter quantity or exclude');
        if (item.unit_cents === null) missing.push('Needs price');
        else if (item.unit_cents === 0 && !item.notes) missing.push('Explain zero cost in notes');
        if (item.kind === 'Material' && item.waste === null) missing.push('Review waste allowance');
        if (item.unit_cents !== null && (!item.price_source || !item.price_date)) missing.push('Record price source and date');
      }
      item.flags = missing;
      if (missing.length) flags.push({ item_id: item.id, message: `${item.name}: ${missing.join('; ')}` });
      if (item.total_cents !== null) {
        totals[item.kind === 'Material' ? 'material_cents' : item.kind === 'Labor' ? 'labor_cents' : 'other_cents'] += item.total_cents;
        totals.total_cents += item.total_cents; totals.priced_count++;
      }
    }
    for (const c of checks.filter(c => !c.resolved)) flags.push({ check_id: c.id, message: c.title });
    for (const d of discoveries) flags.push({ discovery_id: d.id, message: `Open discovery: ${d.title}` });
    const markup_cents = pricing.markup === null ? null : Number((BigInt(totals.total_cents) * BigInt(Math.round(pricing.markup * 100)) + 5000n) / 10000n);
    const selling_cents = markup_cents === null ? null : totals.total_cents + markup_cents;
    const gross_margin = selling_cents ? markup_cents / selling_cents * 100 : null;
    const result = { items, checks, context, discoveries, flags, totals, pricing, markup_cents, selling_cents, gross_margin };
    const token = createHash('sha256').update(JSON.stringify(result)).digest('hex');
    const snapshots = db.prepare('SELECT id,label,created_at,content FROM estimate_snapshots WHERE project_id=? ORDER BY created_at DESC,rowid DESC').all(projectId).map(s => {
      const content = JSON.parse(s.content); return { id: s.id, label: s.label, created_at: s.created_at, total_cents: content.totals.total_cents, selling_cents: content.selling_cents ?? null, flag_count: content.flags.length, token: content.token };
    });
    const latest = snapshots[0];
    return { ...result, token, snapshots, changed_since_snapshot: Boolean(latest && latest.token !== token), delta_cents: latest ? totals.total_cents - latest.total_cents : null };
  }
  function seed(projectId, modules) {
    if (!Array.isArray(modules) || !modules.length || modules.length > 8 || modules.some(k => !Object.hasOwn(templates, k))) fail(400, 'Select valid checklist sections.');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const key of new Set(modules)) {
        const template = templates[key];
        template.items.forEach(([name, unit, notes, kind = 'Material'], index) => {
          db.prepare(`INSERT OR IGNORE INTO material_items (id,project_id,section,name,kind,unit,quantity,waste,unit_cents,status,notes,exclusion_reason,price_source,price_date,template_key,created_at,updated_at)
            VALUES (?,?,?,?,?,?,NULL,NULL,NULL,'Suggested',?,'','','',?,?,?)`).run(randomUUID(), projectId, template.section, name, kind, unit, notes, `${key}:${index}`, new Date().toISOString(), new Date().toISOString());
        });
        template.checks.forEach((title, index) => db.prepare('INSERT OR IGNORE INTO estimate_checks(id,project_id,title,template_key) VALUES (?,?,?,?)').run(randomUUID(), projectId, title, `${key}:${index}`));
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  function saveItem(projectId, id, b) {
    if (id && !db.prepare('SELECT id FROM material_items WHERE id=? AND project_id=?').get(id, projectId)) fail(404, 'Item not found in this project.');
    const kind = choose(b.kind, kinds, 'cost type'), status = choose(b.status, ['Suggested', 'Included', 'Excluded'], 'review status');
    const exclusion = text(b.exclusion_reason ?? '', 'exclusion reason');
    if (status === 'Excluded' && !exclusion) fail(400, 'Explain why this item is excluded.');
    const price = decimal(b.unit_price, 'Unit price', 1000000, 2);
    const priceDate = text(b.price_date ?? '', 'price date', 10);
    if (priceDate && (!/^\d{4}-\d{2}-\d{2}$/.test(priceDate) || !Number.isFinite(Date.parse(priceDate)) || new Date(priceDate).toISOString().slice(0,10) !== priceDate)) fail(400, 'Enter a valid price date.');
    const values = [choose(b.section, sections, 'section'), text(b.name, 'item name', 160, true), kind, choose(b.unit, units, 'unit'), decimal(b.quantity, 'Quantity', 100000, 3), kind === 'Material' ? decimal(b.waste, 'Waste percent', 100, 2) : 0, price === null ? null : Math.round(price * 100), status, text(b.notes ?? '', 'notes'), exclusion, text(b.price_source ?? '', 'price source', 300), priceDate];
    const now = new Date().toISOString();
    if (id) {
      const updated = db.prepare('UPDATE material_items SET section=?,name=?,kind=?,unit=?,quantity=?,waste=?,unit_cents=?,status=?,notes=?,exclusion_reason=?,price_source=?,price_date=?,updated_at=?,revision=revision+1 WHERE id=? AND project_id=? AND revision=?').run(...values, now, id, projectId, Number(b.revision) || 0);
      if (!updated.changes) fail(409, 'This item changed on another screen. Close the form, refresh, and try again.');
    } else db.prepare('INSERT INTO material_items(id,project_id,section,name,kind,unit,quantity,waste,unit_cents,status,notes,exclusion_reason,price_source,price_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(), projectId, ...values, now, now);
  }
  return { state, seed, async handle(req, path, project, json, send) {
    const m = path.match(/^\/api\/projects\/([\w-]+)\/estimate(?:\/(seed|items|checks|context|pricing|snapshots)(?:\/([\w-]+))?)?$/);
    if (!m) return false;
    const [, projectId, resource, id] = m; project(projectId);
    if (req.method === 'GET' && !resource) { send(200, state(projectId)); return true; }
    if (req.method === 'GET' && resource === 'snapshots' && id) {
      const s = db.prepare('SELECT * FROM estimate_snapshots WHERE id=? AND project_id=?').get(id, projectId) || fail(404, 'Snapshot not found.');
      send(200, { ...s, content: JSON.parse(s.content) }); return true;
    }
    const b = await json(req);
    if (req.method === 'POST' && resource === 'seed' && !id) seed(projectId, b.modules);
    else if (resource === 'items' && ((req.method === 'POST' && !id) || (req.method === 'PUT' && id))) saveItem(projectId, id, b);
    else if (req.method === 'PUT' && resource === 'checks' && id) {
      if (!db.prepare('SELECT id FROM estimate_checks WHERE id=? AND project_id=?').get(id, projectId)) fail(404, 'Check not found.');
      if (typeof b.resolved !== 'boolean') fail(400, 'Choose a review outcome.');
      const notes = text(b.notes ?? '', 'review notes');
      if (b.resolved && !notes) fail(400, 'Record how this question was addressed before marking it reviewed.');
      const r = db.prepare('UPDATE estimate_checks SET resolved=?,notes=?,revision=revision+1 WHERE id=? AND project_id=? AND revision=?').run(b.resolved ? 1 : 0, notes, id, projectId, Number(b.revision) || 0);
      if (!r.changes) fail(409, 'This check changed on another screen. Refresh and try again.');
    } else if (req.method === 'PUT' && resource === 'pricing' && !id) {
      const markup = decimal(b.markup, 'Markup percent', 500, 2), notes = text(b.notes ?? '', 'pricing notes');
      const existing = db.prepare('SELECT revision FROM estimate_pricing WHERE project_id=?').get(projectId);
      if ((existing?.revision || 0) !== Number(b.revision)) fail(409, 'Markup changed on another screen. Refresh and try again.');
      if (existing) db.prepare('UPDATE estimate_pricing SET markup=?,notes=?,revision=revision+1 WHERE project_id=?').run(markup, notes, projectId);
      else db.prepare('INSERT INTO estimate_pricing(project_id,markup,notes) VALUES (?,?,?)').run(projectId, markup, notes);
    } else if (req.method === 'PUT' && resource === 'context' && !id) {
      const notes = text(b.notes, 'scope notes', 6000), revision = Number(b.revision);
      const existing = db.prepare('SELECT revision FROM estimate_context WHERE project_id=?').get(projectId);
      if ((existing?.revision || 0) !== revision) fail(409, 'Scope notes changed on another screen. Refresh and try again.');
      if (existing) db.prepare('UPDATE estimate_context SET notes=?,revision=revision+1 WHERE project_id=?').run(notes, projectId);
      else db.prepare('INSERT INTO estimate_context(project_id,notes) VALUES (?,?)').run(projectId, notes);
    } else if (req.method === 'POST' && resource === 'snapshots' && !id) {
      const current = state(projectId);
      if (b.token !== current.token) fail(409, 'The estimate changed. Refresh and review it before saving a snapshot.');
      const label = text(b.label, 'snapshot name', 120, true);
      const { snapshots, changed_since_snapshot, delta_cents, ...content } = current;
      db.prepare('INSERT INTO estimate_snapshots VALUES (?,?,?,?,?)').run(randomUUID(), projectId, label, new Date().toISOString(), JSON.stringify(content));
    } else fail(405, 'Method not allowed.');
    send(req.method === 'POST' ? 201 : 200, state(projectId)); return true;
  }};
}

import { measurementUI } from '/measurements.js';
import { equipmentUI } from '/equipment.js';
import { joeUI } from '/joe.js';
import { operationsUI } from '/operations.js';
import { accountUI } from '/accounts.js';
import { securityUI } from '/security.js';
import { materialUI } from '/materials.js';
import { companyUI } from '/company.js';
const $ = selector => document.querySelector(selector);
const themeButton = $('#theme-toggle');
let savedTheme;
try { savedTheme = localStorage.getItem('jobscopes-theme'); } catch {}
function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  themeButton.setAttribute('aria-pressed', String(dark));
  themeButton.textContent = dark ? 'Dark mode: On' : 'Dark mode: Off';
  themeButton.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#101e23' : '#e2f2f0';
}
setTheme(savedTheme ? savedTheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
themeButton.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  setTheme(dark);
  const selected=document.querySelector('[name=appearance][value='+ (dark?'dark':'light') +']');if(selected)selected.checked=true;
  try { localStorage.setItem('jobscopes-theme', dark ? 'dark' : 'light'); } catch {}
});
const main = $('#main'), dialog = $('#editor'), form = $('#editor-form');
const types = ['Basement', 'Kitchen', 'Bathroom', 'Deck', 'Outdoor', 'General remodeling'];
const statuses = ['Discovery', 'Planning', 'In progress', 'On hold', 'Complete'];
const categories = ['General', 'Structure', 'Moisture', 'Electrical', 'Plumbing', 'Materials', 'Site conditions'];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = value => value.toLowerCase().replaceAll(' ', '-');
const badge = value => `<span class="badge ${slug(value)}">${esc(value)}</span>`;
const date = value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const options = (list, selected) => list.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
let projects = [], current = null, tab = 'operations', loadId = 0, toastTimer;
let filters = { query: '', status: '', type: '' };
async function api(path, opts = {}) {
  let response;
  try { response = await fetch(path, opts); } catch { throw new Error('Cannot reach your workspace. Check the connection and keep ContractorSight running on your computer.'); }
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || 'Something went wrong. Please try again.');
  return value;
}
const write = (path, method, value) => api(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
const materials = materialUI({ api, write, esc, field, selectField: (...args) => selectField(...args), openForm, toast, getProject: () => current });
const operations = operationsUI({api,write,esc,field,selectField:(...args)=>selectField(...args),openForm,toast});
const measurements = measurementUI({api,write,esc,field,selectField:(...args)=>selectField(...args),openForm,toast});
const equipment = equipmentUI({api,write,esc,field,selectField:(...args)=>selectField(...args),openForm,toast});
const joe = joeUI({api,write,esc,openForm,field,toast});
const security = securityUI({api,esc});
const account = accountUI({api,write,esc,host:main,openForm,field,selectField:(...args)=>selectField(...args),toast});
const company = companyUI({ api, write, esc, field, selectField: (...args) => selectField(...args), openForm, toast });
function toast(message, error = false) {
  clearTimeout(toastTimer); const el = $('#toast'); el.textContent = message; el.className = error ? 'error' : ''; el.hidden = false;
  toastTimer = setTimeout(() => { el.hidden = true; }, error ? 10000 : 4500);
}
const empty = (title, description, action = '') => `<div class="empty"><div class="empty-icon" aria-hidden="true">▦</div><h2>${title}</h2><p>${description}</p>${action}</div>`;
function dashboard() {
  const active = projects.filter(p => !['Complete', 'On hold'].includes(p.status)).length;
  main.innerHTML = `<section class="page-heading"><div><div class="eyebrow">A clearer view of every job.</div><h1>Your projects</h1><p>The details, discoveries, and next steps. All in one place.</p></div><button class="primary" data-action="new-project"><span aria-hidden="true">＋</span> New project</button></section>
    <section class="stats" aria-label="Workspace totals"><div class="stat"><span>Active projects</span><strong>${active.toString().padStart(2, '0')}</strong></div><div class="stat"><span>Open discoveries</span><strong>${projects.reduce((n,p) => n + p.open_count, 0).toString().padStart(2, '0')}</strong></div><div class="stat"><span>Site photos</span><strong>${projects.reduce((n,p) => n + p.photo_count, 0).toString().padStart(2, '0')}</strong></div></section>
    <section><div class="section-head"><h2>Project board <span class="count">${projects.length}</span></h2><button class="subtle" data-action="refresh">↻ Refresh</button></div>
    <div class="filters"><label class="search filter-label">Search projects<input id="search" type="search" placeholder="Search projects, clients, or addresses…" value="${esc(filters.query)}"></label><label class="filter-label">Filter by status<select id="status-filter"><option value="">All statuses</option>${options(statuses, filters.status)}</select></label><label class="filter-label">Filter by project type<select id="type-filter"><option value="">All project types</option>${options(types, filters.type)}</select></label></div><div id="project-list"></div></section>
    <div class="field-note"><span class="note-icon" aria-hidden="true">↳</span><div><strong>Good projects start with good observations.</strong>Capture what you find on site. Turn the unknowns into a clear next step.</div></div>`;
  renderCards();
  $('#search').addEventListener('input', e => { filters.query = e.target.value; renderCards(); });
  $('#status-filter').addEventListener('change', e => { filters.status = e.target.value; renderCards(); });
  $('#type-filter').addEventListener('change', e => { filters.type = e.target.value; renderCards(); });
}
function renderCards() {
  const results = projects.filter(p => (!filters.status || p.status === filters.status) && (!filters.type || p.type === filters.type) && `${p.name} ${p.client} ${p.address}`.toLowerCase().includes(filters.query.toLowerCase()));
  $('#project-list').innerHTML = !projects.length ? empty('Your next project starts here.', 'Start with your basement, kitchen, bathroom, or deck. Add the details now and capture discoveries as you go.', '<button class="primary" data-action="new-project">＋ Create your first project</button>') : !results.length ? empty('No matching projects', 'Try a different search or clear your filters.', '<button data-action="clear-filters">Clear filters</button>') : `<div class="grid">${results.map(p => `<a class="project-card" href="#project/${p.id}" aria-label="Open ${esc(p.name)}"><div class="card-cover ${slug(p.type)}"><span aria-hidden="true">${p.type === 'Deck' || p.type === 'Outdoor' ? '⌁' : '⌂'}</span><small>${esc(p.type)}</small></div><div class="card-body">${badge(p.status)}<h3>${esc(p.name)}</h3><p>${esc(p.client || 'No client added')}</p><p>${esc(p.address || 'Address not added')}</p></div><div class="card-foot"><span>${p.open_count} open ${p.open_count === 1 ? 'discovery' : 'discoveries'}</span><span>${p.photo_count} photos <span aria-hidden="true">↗</span></span></div></a>`).join('')}</div>`;
}
function projectView() {
  const p = current;
  main.innerHTML = `<a class="back" href="#">← All projects</a><section class="page-heading"><div><div class="eyebrow">${esc(p.type)} / Project workspace</div><h1>${esc(p.name)}</h1><p>${esc(p.address || 'Add a jobsite address to get started.')}</p><div class="detail-meta">${badge(p.status)}<span>${esc(p.client || 'No client added')}</span></div></div><button data-action="edit-project">Edit project <span aria-hidden="true">↗</span></button></section>
    <nav class="upload-actions" aria-label="Quick project actions"><button class="primary" data-action="quick-camera">Take photo</button><button data-action="new-discovery">Log observation</button><button data-action="edit-project">Update project status</button></nav>
    <div class="detail-layout"><section><div class="tabs" role="tablist" aria-label="Project details"><button id="discoveries-tab" role="tab" aria-controls="tab-content" aria-selected="${tab === 'discoveries'}" data-action="discoveries">Discovery Log <span class="count">${p.discoveries.length}</span></button><button id="photos-tab" role="tab" aria-controls="tab-content" aria-selected="${tab === 'photos'}" data-action="photos">Site photos <span class="count">${p.photos.length}</span></button></div><div id="tab-content" role="tabpanel" aria-labelledby="${tab}-tab"></div></section>
    <aside class="detail-sidebar"><section class="panel"><div class="eyebrow">The brief</div><h2>Project details</h2><dl><dt>PROJECT TYPE</dt><dd>${esc(p.type)}</dd><dt>CLIENT / HOMEOWNER</dt><dd>${esc(p.client || 'Not added')}</dd><dt>LOCATION</dt><dd>${esc(p.address || 'Not added')}</dd><dt>SCOPE & NOTES</dt><dd>${esc(p.notes || 'No scope added yet. Use Edit project to describe the work.')}</dd><dt>LAST EDITED</dt><dd>${date(p.updated_at)}</dd></dl></section><section class="panel"><div class="eyebrow">Walkthrough notes</div><h2>Record it while it’s fresh.</h2><p class="muted">Document existing conditions, questions, and unexpected findings. Add a photo and a next step so nothing gets lost.</p><p class="notice">Discovery entries are your field observations. Local photo analysis creates draft findings in Project workspace for human review.</p></section></aside></div>`;
  const tabs = main.querySelector('.tabs');
  tabs.insertAdjacentHTML('afterbegin', `<button id="operations-tab" role="tab" aria-controls="tab-content" aria-selected="${tab==='operations'}" data-action="operations">Project workspace</button>`);
  tabs.insertAdjacentHTML('beforeend', `<button id="materials-tab" role="tab" aria-controls="tab-content" aria-selected="${tab === 'materials'}" data-action="materials">Materials & estimate</button>`);
  tabs.querySelectorAll('[role=tab]').forEach(button => button.tabIndex = button.getAttribute('aria-selected') === 'true' ? 0 : -1);
  if(tab === 'operations') operations.mount($('#tab-content'),p); else if (tab === 'photos') photoView(); else if (tab === 'materials') materials.mount($('#tab-content'), p); else discoveryView();
}
function discoveryView() {
  const entries = current.discoveries;
  $('#tab-content').innerHTML = `<div class="section-head"><h2>What you’re finding</h2><button class="primary" data-action="new-discovery">＋ Log discovery</button></div>${entries.length ? entries.map(d => `<article class="discovery"><div class="discovery-head"><div>${badge(d.priority)} ${badge(d.status)}</div><button class="subtle" data-action="edit-discovery" data-id="${d.id}" aria-label="Edit ${esc(d.title)}">Edit ↗</button></div><h3>${esc(d.title)}</h3><p>${esc(d.description || 'No additional description.')}</p>${d.photo_id ? `<a href="/api/photos/${d.photo_id}" target="_blank" rel="noopener"><img class="discovery-photo" src="/api/photos/${d.photo_id}" alt="Photo attached to ${esc(d.title)}"></a>` : ''}${d.next_step ? `<p class="next-step"><strong>Next step</strong><br>${esc(d.next_step)}</p>` : ''}<div class="timestamp">${esc(d.category)} · Logged ${date(d.created_at)}${d.revision > 1 ? ` · Updated ${date(d.updated_at)}` : ''}</div></article>`).join('') : empty('Every detail has a place.', 'Log an existing condition, a question to investigate, or an unexpected issue. Give it a priority and a next step.')}`;
}
function photoView() {
  $('#tab-content').innerHTML = `<div class="section-head"><h2>A record of the jobsite</h2></div><div class="upload-actions"><button class="primary" data-action="camera">◎ Take photo</button><button data-action="upload">↑ Upload photos</button></div><input id="camera-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden><input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden><p class="upload-note">JPEG, PNG, or WebP · Up to 15 MB per photo. On a phone, Take photo opens the camera when supported.</p><div id="upload-status" role="status" aria-live="polite"></div>${current.photos.length ? `<div class="photos">${current.photos.map(p => `<figure class="photo"><a href="/api/photos/${p.id}" target="_blank" rel="noopener"><img src="/api/photos/${p.id}" alt="${esc(p.name)}" loading="lazy"></a><figcaption>${esc(p.name)}<small>${date(p.created_at)}</small><button type="button" data-measure-photo="${p.id}">Measurements</button></figcaption></figure>`).join('')}</div>` : empty('See the whole picture.', 'Capture the space before work begins, document progress, and attach evidence to a discovery.')}`;
  $('#tab-content').insertAdjacentHTML('beforeend','<div id="measurement-editor"></div>');
  document.querySelectorAll('[data-measure-photo]').forEach(b=>b.onclick=()=>measurements.mount($('#measurement-editor'),current.id,current.photos.find(p=>p.id===b.dataset.measurePhoto)));
  $('#camera-input').addEventListener('change', uploadPhotos);
  $('#photo-input').addEventListener('change', uploadPhotos);
}
async function uploadPhotos(event) {
  const input = event.target, files = [...input.files], projectId = current.id;
  if (!files.length) return;
  const statusEl = $('#upload-status'); let completed = 0; const failures = [];
  const buttons = [...document.querySelectorAll('.upload-actions button')]; buttons.forEach(b => b.disabled = true);
  for (const [i, file] of files.entries()) {
    statusEl.textContent = `Uploading ${i + 1} of ${files.length}: ${file.name}`;
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error('Larger than 15 MB.');
      await api(`/api/projects/${projectId}/photos?name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file }); completed++;
    } catch (e) { failures.push(`${file.name}: ${e.message}`); }
  }
  buttons.forEach(b => b.disabled = false); input.value = '';
  if (current?.id === projectId) {
    try {
      const refreshed = await api(`/api/projects/${projectId}`);
      if (current?.id === projectId) { current = refreshed; projectView(); }
    } catch (e) { toast(e.message, true); }
    if (failures.length && $('#upload-status')) { $('#upload-status').className = 'error'; $('#upload-status').textContent = failures.join(' '); }
  }
  toast(`${completed} ${completed === 1 ? 'photo' : 'photos'} saved.${failures.length ? ` ${failures.length} failed; you can retry those files.` : ''}`, Boolean(failures.length));
}
function field(label, name, value, { required = false, max = 160, full = false, area = false } = {}) {
  return `<label class="${full ? 'full' : ''}">${label}${required ? ' *' : ''}${area ? `<textarea name="${name}" maxlength="${max}" ${required ? 'required' : ''}>${esc(value)}</textarea>` : `<input name="${name}" value="${esc(value)}" maxlength="${max}" ${required ? 'required' : ''}>`}</label>`;
}
const selectField = (label, name, list, selected) => `<label>${label}<select name="${name}">${options(list, selected)}</select></label>`;
function openForm(title, subtitle, fields, save, saveLabel) {
  form.innerHTML = `<div class="dialog-head"><div><h2 id="dialog-title">${esc(title)}</h2><p>${esc(subtitle)}</p></div><button type="button" class="close" data-close aria-label="Close form">×</button></div><div id="form-error" class="error" role="alert" hidden></div><div class="form-grid">${fields}</div><div class="form-actions"><button type="button" data-close>Cancel</button><button class="primary" type="submit">${esc(saveLabel || `Save ${title.includes('discovery') ? 'discovery' : 'project'}`)}</button></div>`;
  form.querySelectorAll('[data-close]').forEach(b => b.onclick = () => dialog.close());
  form.onsubmit = async e => {
    e.preventDefault(); const button = form.querySelector('[type=submit]'); const oldText = button.textContent;
    button.disabled = true; button.textContent = 'Saving…'; $('#form-error').hidden = true;
    try { await save(Object.fromEntries(new FormData(form))); dialog.close(); }
    catch (error) { $('#form-error').textContent = error.message; $('#form-error').hidden = false; }
    finally { button.disabled = false; button.textContent = oldText; }
  };
  dialog.showModal();
}
function projectForm(edit = false) {
  const p = edit ? current : { name: '', client: '', address: 'Ashtabula, OH', notes: '', type: 'General remodeling', status: 'Discovery' };
  openForm(edit ? 'Edit project' : 'New project', 'Start with the essentials. Refine the details as you go.',
    field('Project name', 'name', p.name, { required: true, max: 120, full: true }) + field('Client / homeowner', 'client', p.client, { full: true }) + field('Jobsite address', 'address', p.address, { max: 300, full: true }) + selectField('Project type', 'type', types, p.type) + selectField('Status', 'status', statuses, p.status) + field('Scope & notes', 'notes', p.notes, { area: true, max: 4000, full: true }),
    async values => {
      const saved = await write(edit ? `/api/projects/${p.id}` : '/api/projects', edit ? 'PUT' : 'POST', { ...values, revision: p.revision });
      toast(edit ? 'Project updated.' : 'Project created. Your workspace is ready.');
      if (location.hash === `#project/${saved.id}`) { current = saved; projectView(); } else { tab = 'discoveries'; location.hash = `project/${saved.id}`; }
    });
}
function discoveryForm(id) {
  const projectId = current.id;
  const d = id ? current.discoveries.find(d => d.id === id) : { title: '', description: '', category: 'General', priority: 'Medium', status: 'Open', next_step: '', photo_id: '' };
  openForm(id ? 'Edit discovery' : 'Log discovery', 'Capture the observation and what needs to happen next.',
    field('What did you find?', 'title', d.title, { required: true, max: 160, full: true }) + field('Description / location within the site', 'description', d.description, { area: true, max: 4000, full: true }) + selectField('Category', 'category', categories, d.category) + selectField('Priority', 'priority', ['Low', 'Medium', 'High'], d.priority) + selectField('Status', 'status', ['Open', 'Resolved'], d.status) + `<label>Attach site photo<select name="photo_id"><option value="">No photo</option>${current.photos.map(p => `<option value="${p.id}" ${p.id === d.photo_id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` + field('Next step', 'next_step', d.next_step, { area: true, max: 2000, full: true }) + (current.photos.length ? '' : '<p class="notice full">To attach a photo, upload it in Site photos first. You can edit this discovery afterward.</p>'),
    async values => {
      const saved = await write(`/api/projects/${projectId}/discoveries${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', { ...values, revision: d.revision });
      // Update from the confirmed write, so a later network failure cannot cause duplicate submissions.
      if (current?.id === projectId) { current.discoveries = id ? current.discoveries.map(entry => entry.id === id ? saved : entry) : [saved, ...current.discoveries]; tab = 'discoveries'; projectView(); }
      toast(id ? 'Discovery updated.' : 'Discovery logged.');
    });
}

function settingsNavigation() {
  return '<nav class="settings-nav" aria-label="Settings sections">'+[['#settings','Company & team'],['#settings/appearance','Appearance'],['#settings/assistant','Joe assistant'],['#settings/security','Security & backups']].map(([url,label])=>`<a href="${url}" ${location.hash===url?'aria-current="page"':''}>${label}</a>`).join('')+'</nav>';
}
function appearanceView() {
  const dark=document.documentElement.dataset.theme==='dark';
  main.innerHTML=`<section class="page-heading"><div><div class="eyebrow">Workspace settings</div><h1>Appearance</h1><p>Choose a comfortable display for the office or jobsite.</p></div></section><section class="panel appearance-panel"><h2>Color mode</h2><p class="notice">Teal accents in both modes. Your choice is saved in this browser.</p><label><input type="radio" name="appearance" value="light" ${!dark?'checked':''}> Light — bright surfaces and dark text</label><label><input type="radio" name="appearance" value="dark" ${dark?'checked':''}> Dark — low-light surfaces and teal accents</label></section>`;
  main.querySelectorAll('[name=appearance]').forEach(input=>input.onchange=()=>{setTheme(input.value==='dark');try{localStorage.setItem('jobscopes-theme',input.value);}catch{}});
}

async function load() {
  if (location.hash === '#team') history.replaceState(null,'','#settings');
  if (location.hash === '#security') history.replaceState(null,'','#settings/security');
  const ticket = ++loadId; const match = location.hash.match(/^#project\/([\w-]+)$/);
  document.querySelectorAll('.sidebar .nav-link').forEach(link => {
    const selected = link.getAttribute('href') === (location.hash.startsWith('#settings') ? '#settings' : location.hash.startsWith('#joe') ? '#joe' : ['#company','#statistics','#equipment'].includes(location.hash) ? location.hash : '#');
    if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  if (dialog.open) dialog.close();
  main.setAttribute('aria-busy', 'true');
  try {
    joe.hide();
    if (!await account.check()) return;
    if (ticket !== loadId) return;
    if (location.hash.startsWith('#settings')) {
      main.onclick=null;current=null;$('#breadcrumb').textContent='Settings';
      if(location.hash==='#settings/security') await security.mount(main);
      else if(location.hash==='#settings/appearance') appearanceView();
      else if(location.hash==='#settings/assistant') joe.settings(main);
      else await account.mount();
      if(ticket!==loadId)return;
      main.insertAdjacentHTML('afterbegin',settingsNavigation());
    }
    else if (/^#joe(?:\/[\w-]+)?$/.test(location.hash)) {current=null; $('#breadcrumb').textContent='Ask Joe'; await joe.mount(main,location.hash.split('/')[1]||'');}
    else if(location.hash==='#equipment'){main.onclick=null;current=null;$('#breadcrumb').textContent='Equipment & Fleet';await equipment.mount(main);}
    else if (['#company','#statistics'].includes(location.hash)) { current = null; $('#breadcrumb').textContent = location.hash === '#statistics' ? 'Statistics' : 'Company'; await company.mount(main); }
    else if (match) { main.onclick = null; const data = await api(`/api/projects/${match[1]}`); if (ticket !== loadId) return; current = data; $('#breadcrumb').textContent = 'Project workspace'; projectView(); }
    else { main.onclick = null; const data = await api('/api/projects'); if (ticket !== loadId) return; projects = data; current = null; $('#breadcrumb').textContent = 'Projects'; dashboard(); }
  } catch (e) { if (ticket === loadId) main.innerHTML = empty('Workspace unavailable', esc(e.message), '<button data-action="refresh">Try again</button> <a class="button" href="#">All projects</a>'); }
  finally { if (ticket === loadId) {main.removeAttribute('aria-busy');joe.widgets(current);} }
}
main.addEventListener('click', e => {
  const button = e.target.closest('[data-action]'); if (!button) return;
  switch (button.dataset.action) {
    case 'new-project': projectForm(); break;
    case 'edit-project': projectForm(true); break;
    case 'new-discovery': discoveryForm(); break;
    case 'edit-discovery': discoveryForm(button.dataset.id); break;
    case 'refresh': load(); break;
    case 'clear-filters': filters = { query: '', status: '', type: '' }; dashboard(); break;
    case 'operations': tab = 'operations'; projectView(); $('#operations-tab').focus(); break;
    case 'discoveries': tab = 'discoveries'; projectView(); $('#discoveries-tab').focus(); break;
    case 'photos': tab = 'photos'; projectView(); $('#photos-tab').focus(); break;
    case 'materials': tab = 'materials'; projectView(); $('#materials-tab').focus(); break;
    case 'quick-camera': tab = 'photos'; projectView(); $('#camera-input').click(); break;
    case 'camera': $('#camera-input').click(); break;
    case 'upload': $('#photo-input').click(); break;
  }
});
main.addEventListener('keydown', e => {
  if (e.target.matches('[role=tab]') && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); const tabs = ['operations', 'discoveries', 'photos', 'materials']; tab = tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : 3)) % 4]; projectView(); $(`#${tab}-tab`).focus(); }
});
window.addEventListener('hashchange', () => { tab = 'operations'; load(); window.scrollTo(0, 0); });
window.addEventListener('offline', () => toast('You’re offline. Reconnect before saving changes.', true));
load();

// Keep photo viewing inside the authenticated app rather than a raw-image tab.
document.addEventListener('click',e=>{
 const link=e.target.closest('a[href^="/api/photos/"]');if(!link)return;
 e.preventDefault();const viewer=document.createElement('dialog');viewer.className='photo-viewer';
 const close=document.createElement('button');close.type='button';close.textContent='Close photo';close.onclick=()=>viewer.close();
 const image=document.createElement('img');image.alt=link.querySelector('img')?.alt||'Project photo';image.src=link.getAttribute('href');
 const message=document.createElement('p');message.textContent='Loading photo…';message.setAttribute('role','status');image.onload=()=>message.textContent='';image.onerror=()=>message.textContent='Photo could not load. Close this view and refresh the project, then try again.';
 viewer.append(close,message,image);document.body.append(viewer);viewer.addEventListener('close',()=>viewer.remove());viewer.showModal();
});

const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const sections = ['Basement finishing', 'Music room', 'Bathroom', 'Kitchen', 'Deck / outdoor', 'General work', 'Project costs'];
const units = ['each', 'sq ft', 'linear ft', 'sheet', 'bag', 'box', 'roll', 'tube', 'gallon', 'hour', 'day', 'allowance'];
const modules = { basement: 'Basement finishing', music: 'Music room', bathroom: 'Bathroom remodel', kitchen: 'Kitchen', outdoor: 'Deck / outdoor', general: 'General remodeling', costs: 'Labor and project costs' };

export function materialUI({ api, write, esc, field, selectField, openForm, toast, getProject }) {
  let state, host, projectId, request = 0;
  let view = { section: '', status: '' };
  const endpoint = () => `/api/projects/${projectId}/estimate`;
  const active = () => host?.isConnected && getProject()?.id === projectId;
  const num = (label, name, value, step, max) => `<label>${label}<input name="${name}" type="number" min="0" max="${max}" step="${step}" value="${value ?? ''}" placeholder="Not entered"></label>`;
  function setState(next) { if (active()) { state = next; render(); } }
  async function mount(target, project) {
    host = target; projectId = project.id; state = null; view = { section: '', status: '' }; const ticket = ++request;
    target.innerHTML = '<p class="muted" role="status">Loading materials and estimate checks…</p>';
    try { const next = await api(endpoint()); if (ticket === request && active()) { state = next; render(); } }
    catch (e) { if (ticket === request && active()) { target.innerHTML = `<div class="error" role="alert">${esc(e.message)}</div><button data-material="refresh">Try again</button>`; } }
    target.onclick = e => {
      const button = e.target.closest('[data-material]'); if (!button) return;
      const action = button.dataset.material;
      if (action === 'refresh') { mount(target, project); return; }
      if (!state) return;
      if (action === 'seed') seedForm();
      if (action === 'source') {
        const source=state.sources.find(s=>s.id===button.dataset.id);
        const path=endpoint(),pId=projectId;
        openForm(source.link?'Review changed source':'Add discovery to estimate','Creates an unpriced suggestion for your review. This does not authorize construction work.',`<p class="full"><strong>${esc(source.title)}</strong><br>${esc(source.description)}</p><label class="full"><input name="reviewed" type="checkbox" required> I reviewed this source${source.link?' and checked the linked estimate item':''}.</label>`,async()=>{const next=await write(`${path}/sources/${source.id}`,'POST',{kind:source.kind,revision:source.revision,reviewed:true,acknowledge:Boolean(source.link)});if(projectId===pId)setState(next);},source.link?'Record review':'Add unpriced suggestion');
      }
      if (action === 'add') itemForm();
      if (action === 'edit') itemForm(button.dataset.id);
      if (action === 'check') checkForm(button.dataset.id);
      if (action === 'context') contextForm();
      if (action === 'pricing') pricingForm();
      if (action === 'snapshot') snapshotForm();
      if (action === 'view-snapshot') showSnapshot(button.dataset.id).catch(e => toast(e.message, true));
      if (action === 'jump') {
        const item = target.querySelector(`[data-row="${button.dataset.id}"]`);
        if (item) { item.scrollIntoView({ behavior: 'smooth', block: 'center' }); item.querySelector('button')?.focus(); }
        else { view = { section: '', status: '' }; render(); target.querySelector(`[data-row="${button.dataset.id}"]`)?.scrollIntoView({ block: 'center' }); }
      }
    };
  }
  function render() {
    const { items, flags, totals, checks, context, snapshots } = state;
    const excluded = items.filter(i => i.status === 'Excluded').length;
    host.innerHTML = `<div class="estimate-intro"><div class="eyebrow">Catch the small things before they cost you.</div><h2>Materials & estimate check</h2><p class="muted">Start with Add suggested checklist or Add item. Review each line, enter quantity and price, and choose Included to count it. Then Set markup to calculate your selling price.</p></div>
      <div class="estimate-toolbar"><button class="primary" data-material="add">＋ Add item</button><button data-material="seed">Add suggested checklist</button><button class="subtle" data-material="refresh">↻ Refresh</button></div><div class="estimate-totals"><div><span>Included, priced subtotal</span><strong>${money(totals.total_cents)}</strong><small>${totals.priced_count} of ${items.filter(i => i.status === 'Included').length} included lines priced</small></div><div><span>Review gaps</span><strong>${flags.length}</strong><small>${excluded} ${excluded === 1 ? 'exclusion' : 'exclusions'} recorded</small></div></div>
      <p class="notice">${flags.length ? 'Partial cost only — unresolved items are not treated as free.' : 'No checklist gaps detected. Confirm scope and pricing before quoting.'} This worksheet is not a finalized customer quote.</p>
      <div class="cost-breakdown"><span>Materials <b>${money(totals.material_cents)}</b></span><span>Labor <b>${money(totals.labor_cents)}</b></span><span>Other costs <b>${money(totals.other_cents)}</b></span></div>
      <section class="pricing-panel"><div class="section-head"><h3>Markup & selling price</h3><button data-material="pricing">Set markup</button></div><dl class="line-numbers"><div><dt>Markup on cost</dt><dd>${state.pricing.markup === null ? 'Not set' : `${state.pricing.markup}%`}</dd></div><div><dt>Amount added</dt><dd>${state.markup_cents === null ? '—' : money(state.markup_cents)}</dd></div><div><dt>Estimated selling price</dt><dd>${state.selling_cents === null ? '—' : money(state.selling_cents)}</dd></div><div><dt>Estimated margin</dt><dd>${state.gross_margin === null ? '—' : `${state.gross_margin.toFixed(1)}%`}</dd></div></dl><div class="company-metrics"><div class="company-metric"><span>Estimated profit on priced items</span><strong>${state.markup_cents === null ? 'Not available' : money(state.markup_cents)}</strong></div><div class="company-metric"><span>Return on job cost</span><strong>${state.estimated_return_percent == null ? 'Not available' : state.estimated_return_percent.toFixed(1)+'%'}</strong></div></div><p class="notice">${flags.length ? 'Provisional: resolve the review gaps before relying on these returns.' : 'Estimated results, not actual profit.'} Return on job cost = profit ÷ cost; margin = profit ÷ selling price. Overhead is covered only to the extent you included it in costs.</p><p class="notice">Markup applies to the entire included, priced subtotal, including any tax or allowance lines you entered. Unpriced work is still missing. Gross margin must cover overhead and profit; it is not net profit.</p>${state.pricing.notes ? `<p class="scope-notes">${esc(state.pricing.notes)}</p>` : ''}
      <p class="notice"><strong>Suggested markup: 29.9%</strong> — your workspace starting point, fully editable. This gives approximately 23% gross margin. Select Set markup to apply it or enter your own rate.</p><details class="benchmark"><summary>Pricing reference · Ashtabula / Northeast Ohio</summary><p>No reliable local average markup was found in the sources checked. The 29.9% suggested markup is your chosen workspace preference, not a local market average.</p><p><strong>National context:</strong> NAHB reports a 29.9% average gross margin for residential remodelers in fiscal 2024. That corresponds mathematically to about <strong>42.7% markup on cost</strong>—a conversion, not a measured local markup or a recommended rate.</p><p>Published April 2026; checked September 20, 2026. Company-wide results may not match your job costs or overhead. <a href="https://www.nahb.org/blog/2026/04/home-remodeling-profit-margin" target="_blank" rel="noopener">Read the NAHB source ↗</a></p><p>For comparison: 20% markup gives 16.7% margin; 25% markup gives 20% margin; 50% markup gives 33.3% margin.</p></details></section>
      <details class="estimate-details" ${context.notes ? '' : 'open'}><summary>Scope, measurements & assumptions</summary><p class="scope-notes">${esc(context.notes || 'Record measurements and decisions here. Suggestions do not calculate quantities from photos or room size.')}</p><button data-material="context">Edit scope notes</button></details>

      ${!items.length ? '<div class="empty"><h3>Start with a checklist.</h3><p>Add suggested sections for this project, or create your own items. Nothing is included in your costs until you review it.</p></div>' : `<div class="filters"><label class="filter-label">Checklist section<select id="material-section"><option value="">All sections</option>${sections.map(s => `<option ${s === view.section ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label class="filter-label">Review status<select id="material-status"><option value="">All items</option>${['Suggested', 'Included', 'Excluded'].map(s => `<option ${s === view.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div><div id="material-lines"></div>`}
      <details class="estimate-details" open><summary>Before you quote <span class="count">${flags.length} gaps</span></summary><p class="notice">Suggestions are scope reminders, not a complete specification. Review overlaps between sections and split allowances into individual products where needed.</p>
      ${checks.map(c => `<div class="review-check"><div><strong>${esc(c.title)}</strong><small>${c.resolved ? 'Reviewed' : 'Needs review'}${c.notes ? ` · ${esc(c.notes)}` : ''}</small></div><button data-material="check" data-id="${c.id}">${c.resolved ? 'Edit review' : 'Review'}</button></div>`).join('')}
      ${state.discoveries.length ? `<p class="error">${state.discoveries.length} open ${state.discoveries.length === 1 ? 'discovery may' : 'discoveries may'} affect scope or cost. Review them in the Discovery Log.</p>` : ''}
      ${items.some(i => i.flags.length) ? `<details><summary>Item gaps (${items.filter(i => i.flags.length).length})</summary><ul class="gap-list">${items.filter(i => i.flags.length).map(i => `<li><button class="subtle" data-material="jump" data-id="${i.id}">${esc(i.name)}</button><span>${esc(i.flags.join(' · '))}</span></li>`).join('')}</ul></details>` : ''}
      ${flags.length ? '' : '<p class="review-ok">Checklist reviewed. This does not certify completeness or construction compliance.</p>'}</details>
      <section class="estimate-history"><div class="section-head"><h2>Saved estimates</h2><button data-material="snapshot">Save estimate copy</button></div><p class="notice">Preserve the worksheet as it stands. Saved copies keep every unresolved item visible.</p>
      ${snapshots.length ? `<p class="${state.changed_since_snapshot ? 'change-note' : 'notice'}">${state.changed_since_snapshot ? `Worksheet changed since the latest snapshot. Priced subtotal difference: ${money(state.delta_cents)}. Unpriced additions may cost more.` : 'Worksheet matches the latest snapshot.'}</p>${snapshots.map(s => `<button class="snapshot-row" data-material="view-snapshot" data-id="${s.id}"><span><strong>${esc(s.label)}</strong><small>${new Date(s.created_at).toLocaleString()} · ${s.flag_count ? `Draft · ${s.flag_count} gaps` : 'Checklist reviewed'}</small></span><b>${money(s.total_cents)} ↗</b></button>`).join('')}` : '<p class="muted">No saved estimates yet.</p>'}</section>`;
    const sourceSection=document.createElement('section');sourceSection.className='panel';
    sourceSection.innerHTML=`<h2>Discoveries to price</h2><p class="notice">Review observations here and add cost reminders. AI findings must first be confirmed in Site analysis. Linked items remain editable and can be excluded with a reason.</p>${(state.sources||[]).map(s=>`<div class="review-check"><div><strong>${esc(s.title)}</strong><small>${esc(s.kind)} · ${esc(s.status)}${s.link?' · Linked to estimate':''}</small></div>${s.link&&s.link.source_revision===s.revision?`<button data-material="jump" data-id="${s.link.item_id}">View item</button>`:s.eligible?`<button data-material="source" data-id="${s.id}">${s.link?'Review source change':'Add to estimate'}</button>`:'<span>Confirm in Site analysis</span>'}</div>`).join('')||'<p>No discoveries recorded yet.</p>'}`;
    host.append(sourceSection);
    if (items.length) {
      renderLines();
      host.querySelector('#material-section').onchange = e => { view.section = e.target.value; renderLines(); };
      host.querySelector('#material-status').onchange = e => { view.status = e.target.value; renderLines(); };
    }
  }
  function renderLines() {
    const visible = state.items.filter(i => (!view.section || i.section === view.section) && (!view.status || i.status === view.status));
    host.querySelector('#material-lines').innerHTML = visible.length ? sections.map(section => {
      const list = visible.filter(i => i.section === section); if (!list.length) return '';
      return `<section class="material-group"><h3>${section}<span class="count">${list.length}</span></h3>${list.map(i => `<article class="material-line" data-row="${i.id}"><div class="material-title"><div><span class="badge ${i.status.toLowerCase()}">${i.status}</span><span class="line-kind">${i.kind}</span><h4>${esc(i.name)}</h4></div><button data-material="edit" data-id="${i.id}" aria-label="Edit ${esc(i.name)}">Edit</button></div><p class="line-notes">${esc(i.notes)}</p>
        ${i.status === 'Excluded' ? `<p class="notice">Excluded: ${esc(i.exclusion_reason)}</p>` : `<dl class="line-numbers"><div><dt>Quantity</dt><dd>${i.quantity ?? '—'} ${esc(i.unit)}</dd></div><div><dt>${i.kind === 'Material' ? 'Waste' : 'Cost type'}</dt><dd>${i.kind === 'Material' ? i.waste === null ? 'Not reviewed' : `${i.waste}%` : i.kind}</dd></div><div><dt>Unit price</dt><dd>${i.unit_cents === null ? '—' : money(i.unit_cents)}</dd></div><div><dt>Included cost</dt><dd>${i.total_cents === null ? 'Not totaled' : money(i.total_cents)}</dd></div></dl>${i.flags.length ? `<p class="line-warning">${esc(i.flags.join(' · '))}</p>` : ''}${i.price_source ? `<p class="notice">Price: ${esc(i.price_source)}${i.price_date ? ` · ${i.price_date}` : ''}</p>` : ''}`}</article>`).join('')}</section>`;
    }).join('') : '<p class="empty">No items match these filters.</p>';
  }
  function itemForm(id) {
    const path = endpoint(); const pId = projectId;
    const item = id ? state.items.find(i => i.id === id) : { name: '', section: view.section || (getProject().type === 'Basement' ? 'Basement finishing' : 'General work'), kind: 'Material', unit: 'each', quantity: null, waste: null, unit_cents: null, status: 'Suggested', notes: '', exclusion_reason: '', price_source: '', price_date: '' };
    openForm(id ? 'Edit cost item' : 'Add cost item', 'To count this item: choose Included, enter quantity and unit price, and enter a waste percentage for materials (0 if none). Blank amounts stay unknown.',
      field('Item name', 'name', item.name, { required: true, full: true }) + selectField('Section', 'section', sections, item.section) + selectField('Cost type', 'kind', ['Material', 'Labor', 'Other cost'], item.kind) + selectField('Review status', 'status', ['Suggested', 'Included', 'Excluded'], item.status) + selectField('Unit', 'unit', units, item.unit) + num('Quantity', 'quantity', item.quantity, '0.001', 100000) + num('Waste allowance (%) — materials only', 'waste', item.waste, '0.01', 100) + num('Unit price ($)', 'unit_price', item.unit_cents === null ? null : item.unit_cents / 100, '0.01', 1000000) + `<label>Price date<input type="date" name="price_date" value="${item.price_date}"></label>` + field('Price source / supplier quote', 'price_source', item.price_source, { full: true, max: 300 }) + field('Notes / measurement basis', 'notes', item.notes, { area: true, full: true, max: 2000 }) + field('Reason if excluded', 'exclusion_reason', item.exclusion_reason, { full: true, max: 2000 }) + '<p class="notice full">Line cost = quantity × (1 + waste %) × unit price, rounded to cents. Waste applies only to materials. No automatic pack rounding; enter purchase units yourself. Use 0% when no extra allowance is needed.</p>',
      async values => { const next = await write(`${path}/items${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', { ...values, revision: item.revision }); if (projectId === pId) setState(next); toast('Cost item saved.'); }, 'Save item');
  }
  function seedForm() {
    const path = endpoint(), pId = projectId;
    const defaults = { Basement: ['basement', 'costs'], Bathroom: ['bathroom', 'costs'], Kitchen: ['kitchen', 'costs'], Deck: ['outdoor', 'costs'], Outdoor: ['outdoor', 'costs'] }[getProject().type] || ['general', 'costs'];
    openForm('Suggested checklist', 'Choose applicable sections. Existing items and edits stay intact.', Object.entries(modules).map(([key, label]) => `<label class="check-option full"><input type="checkbox" name="${key}" value="yes" ${defaults.includes(key) ? 'checked' : ''}>${label}</label>`).join('') + '<p class="notice full">These are editable checklist suggestions. Quantities and prices start blank; no automatic photo analysis or supplier pricing is used. Adding a section twice does not duplicate it.</p>', async values => {
      const next = await write(`${path}/seed`, 'POST', { modules: Object.keys(modules).filter(k => values[k] === 'yes') }); if (projectId === pId) setState(next); toast('Checklist suggestions added.');
    }, 'Add suggestions');
  }
  function checkForm(id) {
    const c = state.checks.find(c => c.id === id), path = endpoint(), pId = projectId;
    openForm('Review scope question', c.title, selectField('Outcome', 'outcome', ['Needs review', 'Reviewed'], c.resolved ? 'Reviewed' : 'Needs review') + field('Findings / decision and cost impact', 'notes', c.notes, { full: true, area: true, max: 2000 }), async values => {
      const next = await write(`${path}/checks/${id}`, 'PUT', { resolved: values.outcome === 'Reviewed', notes: values.notes, revision: c.revision }); if (projectId === pId) setState(next); toast('Review saved.');
    }, 'Save review');
  }
  function contextForm() {
    const c = state.context, path = endpoint(), pId = projectId;
    openForm('Scope & measurements', 'Record known details and what remains uncertain.', field('Project facts and assumptions', 'notes', c.notes, { full: true, area: true, max: 6000 }), async values => {
      const next = await write(`${path}/context`, 'PUT', { ...values, revision: c.revision }); if (projectId === pId) setState(next); toast('Scope notes saved.');
    }, 'Save notes');
  }
  function pricingForm() {
    const p = state.pricing, path = endpoint(), pId = projectId;
    openForm('Project markup', 'Suggested: 29.9% markup. Keep it or enter a custom rate.', num('Markup on cost (%)', 'markup', p.markup ?? 29.9, '0.01', 500) + '<div><button type="button" id="suggested-markup">Use suggested 29.9%</button></div>' + field('Pricing / overhead notes', 'notes', p.notes, { full: true, area: true, max: 2000 }) + '<p class="notice full">Example: $1,000 cost + 29.9% markup = $1,299 selling price and about 23% gross margin. The markup applies to all included costs, including tax lines. Leave blank to keep pricing unresolved, or enter 0% explicitly. This suggestion is your workspace preference, not a verified local average.</p>', async values => {
      const next = await write(`${path}/pricing`, 'PUT', { ...values, revision: p.revision }); if (projectId === pId) setState(next); toast('Markup saved.');
    }, 'Save markup');
    document.querySelector('#suggested-markup').onclick = () => { document.querySelector('#editor-form [name=markup]').value = '29.9'; };
  }
  function snapshotForm() {
    const path = endpoint(), pId = projectId, token = state.token;
    openForm('Save estimate copy', state.flags.length ? `Draft worksheet: ${state.flags.length} review gaps remain.` : 'Save a record of the reviewed worksheet.', field('Estimate name', 'label', `Estimate ${state.snapshots.length + 1}`, { required: true, full: true, max: 120 }) + `<p class="notice full">Priced subtotal: ${money(state.totals.total_cents)}. All lines, exclusions, scope notes and open questions will be preserved. This does not send an estimate to anyone.</p>`, async values => {
      const next = await write(`${path}/snapshots`, 'POST', { ...values, token }); if (projectId === pId) setState(next); toast('Estimate copy saved.');
    }, 'Save estimate copy');
    document.querySelector('#editor-form .form-grid').insertAdjacentHTML('beforeend', `<p class="notice full">Markup: ${state.pricing.markup === null ? 'not set' : state.pricing.markup + '%'} · Estimated selling price: ${state.selling_cents === null ? 'not calculated' : money(state.selling_cents)}.</p>`);
  }
  async function showSnapshot(id) {
    const path = endpoint(), pId = projectId;
    const snapshot = await api(`${path}/snapshots/${id}`); if (!active() || projectId !== pId) return;
    const c = snapshot.content;
    const dialog = document.querySelector('#editor'), form = document.querySelector('#editor-form');
    form.onsubmit = e => e.preventDefault();
    form.innerHTML = `<div class="dialog-head"><div><h2 id="dialog-title">${esc(snapshot.label)}</h2><p>${new Date(snapshot.created_at).toLocaleString()} · Saved snapshot</p></div><button type="button" class="close" aria-label="Close snapshot">×</button></div><p><strong>${money(c.totals.total_cents)}</strong> included, priced subtotal · ${c.flags.length} review gaps</p><p class="notice">Historical worksheet; later edits do not change these values.</p><p class="scope-notes">${esc(c.context.notes)}</p>${sections.map(s => { const rows = c.items.filter(i => i.section === s); return rows.length ? `<h3>${s}</h3>${rows.map(i => `<div class="snapshot-item"><strong>${esc(i.name)}</strong><small>${i.status} · ${i.quantity ?? 'Unknown quantity'} ${esc(i.unit)} · ${i.unit_cents === null ? 'Unknown price' : money(i.unit_cents)} / unit${i.kind === 'Material' ? ` · Waste ${i.waste === null ? 'not reviewed' : i.waste + '%'}` : ''}</small><span>${i.total_cents === null ? 'Not totaled' : money(i.total_cents)}</span><p>${esc(i.status === 'Excluded' ? i.exclusion_reason : i.notes)}</p><small>${esc(i.price_source)} ${esc(i.price_date)}</small></div>`).join('')}` : ''; }).join('')}<h3>Review record</h3>${c.checks.map(check => `<p class="notice"><strong>${esc(check.title)}</strong> — ${check.resolved ? 'Reviewed' : 'Needs review'}<br>${esc(check.notes)}</p>`).join('')}<h3>Saved gaps</h3><ul class="snapshot-gaps">${c.flags.map(f => `<li>${esc(f.message)}</li>`).join('')}</ul><button type="button" class="snapshot-close">Close</button>`;
    form.querySelector('.dialog-head').insertAdjacentHTML('afterend', `<p class="notice">Saved markup: ${c.pricing?.markup == null ? 'not set' : c.pricing.markup + '%'} · Amount added: ${c.markup_cents == null ? '—' : money(c.markup_cents)} · Estimated selling price: ${c.selling_cents == null ? '—' : money(c.selling_cents)} · Gross margin: ${c.gross_margin == null ? '—' : c.gross_margin.toFixed(1) + '%'}.</p>`);
    form.querySelectorAll('.close,.snapshot-close').forEach(b => b.onclick = () => dialog.close()); dialog.showModal();
  }
  return { mount };
}

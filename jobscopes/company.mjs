import { randomUUID } from 'node:crypto';
import { reportingPeriod, estimateReturn } from './reporting.mjs';

const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const transactionTypes = ['Payment received', 'Expense paid', 'Customer refund', 'Supplier refund'];
const categories = ['Materials', 'Labor', 'Subcontractors', 'Equipment', 'Delivery', 'Disposal', 'Permits / fees', 'Overhead', 'Other'];
const str = (v, label, max, required = false) => {
  if (typeof v !== 'string' || v.trim().length > max || (required && !v.trim())) fail(400, `Enter ${label}${required ? ' (required)' : ''}, at most ${max} characters.`);
  return v.trim();
};
function localDate(iso) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function addCash(totals, entry) {
  if (entry.status === 'Voided') return;
  if (entry.type === 'Payment received') totals.received_cents += entry.amount_cents;
  if (entry.type === 'Customer refund') totals.received_cents -= entry.amount_cents;
  if (entry.type === 'Expense paid') totals.spent_cents += entry.amount_cents;
  if (entry.type === 'Supplier refund') totals.spent_cents -= entry.amount_cents;
  totals.net_cents = totals.received_cents - totals.spent_cents;
  totals.entry_count++;
}
const cash = () => ({ received_cents: 0, spent_cents: 0, net_cents: 0, entry_count: 0 });

export function companyStore(db, estimates) {
  db.exec(`CREATE TABLE IF NOT EXISTS cash_entries (
    id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id), entry_date TEXT NOT NULL,
    type TEXT NOT NULL, category TEXT NOT NULL, amount_cents INTEGER NOT NULL,
    description TEXT NOT NULL, status TEXT NOT NULL, void_reason TEXT NOT NULL DEFAULT '',
    revision INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS cash_entries_date ON cash_entries(entry_date);
    CREATE TABLE IF NOT EXISTS company_customers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE);
    CREATE TABLE IF NOT EXISTS job_metrics (
      project_id TEXT PRIMARY KEY REFERENCES projects(id), customer_id TEXT REFERENCES company_customers(id),
      started TEXT NOT NULL DEFAULT '', finished TEXT NOT NULL DEFAULT '', rating INTEGER,
      rating_date TEXT NOT NULL DEFAULT '', feedback TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1);
    PRAGMA user_version = 5;`);
  function report(url) {
    const today = localDate(new Date().toISOString());
    const yearString = url.searchParams.get('year') || today.slice(0,4);
    const quarter = url.searchParams.get('quarter') || 'all';
    if (!/^\d{4}$/.test(yearString) || Number(yearString) < 2000 || Number(yearString) > 2100 || !['all','ytd','1','2','3','4'].includes(quarter)) fail(400, 'Choose a year from 2000–2100 and a valid period.');
    const year = Number(yearString);
    const firstMonth = ['all','ytd'].includes(quarter) ? 1 : (Number(quarter) - 1) * 3 + 1;
    const afterMonth = quarter === 'all' ? 13 : quarter === 'ytd' ? Number(today.slice(5,7)) + 1 : firstMonth + 3;
    const { start, end, previous } = reportingPeriod(year, quarter, today);
    const projects = db.prepare('SELECT id,name,client,type,status,created_at FROM projects ORDER BY name').all();
    const entries = db.prepare(`SELECT e.*,p.name project_name FROM cash_entries e LEFT JOIN projects p ON p.id=e.project_id
      WHERE entry_date>=? AND entry_date<? ORDER BY entry_date DESC,e.created_at DESC`).all(start,end);
    const totals = cash(); entries.forEach(e => addCash(totals,e));
    const priorTotals = cash();
    db.prepare('SELECT * FROM cash_entries WHERE entry_date>=? AND entry_date<?').all(previous.start,previous.end).forEach(e=>addCash(priorTotals,e));
    const comparison = { ...previous, totals: priorTotals,
      received_change_cents: totals.received_cents - priorTotals.received_cents,
      received_change_percent: priorTotals.received_cents > 0 ? (totals.received_cents-priorTotals.received_cents)/priorTotals.received_cents*100 : null };
    const quarters = [1,2,3,4].map(q => ({ quarter:q, ...cash() }));
    db.prepare('SELECT * FROM cash_entries WHERE entry_date>=? AND entry_date<?').all(`${year}-01-01`,`${year+1}-01-01`).forEach(e => addCash(quarters[Math.floor((Number(e.entry_date.slice(5,7))-1)/3)], e));
    const months = Array.from({ length: afterMonth - firstMonth }, (_, i) => ({ month: `${year}-${String(firstMonth+i).padStart(2,'0')}`, ...cash() }));
    entries.forEach(e => addCash(months[Number(e.entry_date.slice(5,7))-firstMonth], e));
    const expenses = categories.map(category => ({ category, cents: entries.filter(e => e.category === category && e.status === 'Recorded').reduce((n,e) => n + (e.type === 'Expense paid' ? e.amount_cents : e.type === 'Supplier refund' ? -e.amount_cents : 0),0) })).filter(c => c.cents !== 0);

    // Count one latest snapshot per project in the selected period, never sum revisions as new sales.
    const latestByProject = new Map();
    for (const s of db.prepare('SELECT rowid,* FROM estimate_snapshots ORDER BY created_at DESC,rowid DESC').all()) {
      const day = localDate(s.created_at);
      if (day >= start && day < end && !latestByProject.has(s.project_id)) latestByProject.set(s.project_id,s);
    }
    const saved = { project_count:latestByProject.size, priced_cost_cents:0, selling_cents:0, selling_count:0, incomplete_count:0, margin_percent:null };
    let pricedCostWithSelling = 0;
    const savedProjects = [];
    for (const [id,s] of latestByProject) {
      const c = JSON.parse(s.content);
      saved.priced_cost_cents += c.totals.total_cents;
      if (c.selling_cents !== null && c.selling_cents !== undefined) { saved.selling_cents += c.selling_cents; saved.selling_count++; pricedCostWithSelling += c.totals.total_cents; }
      if (c.flags.length) saved.incomplete_count++;
      savedProjects.push({ id, name: projects.find(p=>p.id===id)?.name || 'Project', label:s.label, cost_cents:c.totals.total_cents, selling_cents:c.selling_cents ?? null, gap_count:c.flags.length });
    }
    if (saved.selling_cents > 0) saved.margin_percent = (saved.selling_cents - pricedCostWithSelling) / saved.selling_cents * 100;

    const active = projects.filter(p => !['Complete','On hold'].includes(p.status));
    const open = db.prepare("SELECT id,project_id,title,priority,created_at FROM discoveries WHERE status='Open' ORDER BY created_at").all();
    const age = d => Math.max(0, Math.floor((Date.parse(today)-Date.parse(localDate(d.created_at))) / 86400000));
    const operations = { project_count: projects.length, active_count:active.length, tracked_estimates:0, ready_estimates:0,
      unpriced_included:0, unreviewed_suggestions:0, exclusions:0, changed_estimates:0,
      new_included_count:0, new_included_priced_cents:0, new_included_unpriced:0,
      open_discoveries:open.length, high_priority_discoveries:open.filter(d=>d.priority==='High').length,
      discoveries_over_14_days:open.filter(d=>age(d)>=14).length,
      oldest_discovery_days:open.length ? Math.max(...open.map(age)) : null,
      active_with_photos:active.filter(p=>db.prepare('SELECT 1 FROM photos WHERE project_id=? LIMIT 1').get(p.id)).length };
    const attention = [], profitability = [];
    for (const p of projects) {
      const e = estimates.state(p.id);
      if(e.items.length) profitability.push({id:p.id,name:p.name,status:p.status,cost_cents:e.totals.total_cents,selling_cents:e.selling_cents,gap_count:e.flags.length,...estimateReturn(e.totals.total_cents,e.selling_cents,e.flags.length)});
      const unknown = e.items.filter(i=>i.status==='Included' && i.total_cents===null).length;
      operations.unpriced_included += unknown;
      operations.unreviewed_suggestions += e.items.filter(i=>i.status==='Suggested').length;
      operations.exclusions += e.items.filter(i=>i.status==='Excluded').length;
      if (e.items.length) { operations.tracked_estimates++; if (!e.flags.length) operations.ready_estimates++; }
      if (e.changed_since_snapshot) operations.changed_estimates++;
      const first = db.prepare('SELECT content FROM estimate_snapshots WHERE project_id=? ORDER BY created_at,rowid LIMIT 1').get(p.id);
      let added = [];
      if (first) {
        const original = new Set(JSON.parse(first.content).items.filter(i=>i.status==='Included').map(i=>i.id));
        added = e.items.filter(i=>i.status==='Included' && !original.has(i.id));
        operations.new_included_count += added.length;
        operations.new_included_priced_cents += added.reduce((n,i)=>n+(i.total_cents ?? 0),0);
        operations.new_included_unpriced += added.filter(i=>i.total_cents===null).length;
      }
      if (e.items.length && (e.flags.length || added.length || e.changed_since_snapshot)) attention.push({ id:p.id, name:p.name, flags:e.flags.length, unpriced:unknown, new_included:added.length, changed:e.changed_since_snapshot });
    }
    const byProject = projects.map(p => { const total = cash(); entries.filter(e=>e.project_id===p.id).forEach(e=>addCash(total,e)); return { ...p,...total }; }).filter(p=>p.entry_count);
    const overhead = cash(); entries.filter(e=>!e.project_id).forEach(e=>addCash(overhead,e));
    if (overhead.entry_count) byProject.push({ id:null,name:'Company / unassigned',...overhead });
    const photoLeader = db.prepare('SELECT p.id,p.name,count(*) count FROM photos f JOIN projects p ON p.id=f.project_id GROUP BY p.id ORDER BY count DESC,p.name LIMIT 1').get() || null;
    const days = new Map(); entries.filter(e=>e.status==='Recorded').forEach(e=>days.set(e.entry_date,(days.get(e.entry_date)||0)+1));
    const busiestDay = [...days.entries()].sort((a,b)=>b[1]-a[1] || b[0].localeCompare(a[0]))[0];
    const fun = {
      total_photos:db.prepare('SELECT count(*) count FROM photos').get().count, photo_leader:photoLeader,
      resolved_discoveries:db.prepare("SELECT count(*) count FROM discoveries WHERE status='Resolved'").get().count,
      project_types:[...new Set(projects.map(p=>p.type))].sort(),
      busiest_money_day:busiestDay ? { date:busiestDay[0],count:busiestDay[1] } : null
    };
    const customers = db.prepare('SELECT * FROM company_customers ORDER BY name').all();
    const jobs = projects.map(p => ({ ...p, metrics:db.prepare('SELECT j.*,c.name customer_name FROM job_metrics j LEFT JOIN company_customers c ON c.id=j.customer_id WHERE project_id=?').get(p.id) || { customer_id:null,customer_name:null,started:'',finished:'',rating:null,rating_date:'',feedback:'',revision:0 } }));
    const elapsed = (a,b) => Math.round((Date.parse(b)-Date.parse(a))/86400000);
    const completed = jobs.filter(p=>p.metrics.finished>=start && p.metrics.finished<end && p.metrics.started).map(p=>({id:p.id,name:p.name,days:elapsed(p.metrics.started,p.metrics.finished)})).sort((a,b)=>a.days-b.days);
    const durations = completed.map(p=>p.days);
    const middle = Math.floor(durations.length/2);
    const duration = { count:durations.length, average_days:durations.length?durations.reduce((a,b)=>a+b,0)/durations.length:null,
      median_days:durations.length?(durations.length%2?durations[middle]:(durations[middle-1]+durations[middle])/2):null,
      shortest:completed[0]||null,longest:completed.at(-1)||null,completed,
      underway:jobs.filter(p=>p.metrics.started && !p.metrics.finished).map(p=>({id:p.id,name:p.name,days:elapsed(p.metrics.started,today)})),
      missing_dates:jobs.filter(p=>!p.metrics.started).length };
    const responses = jobs.filter(p=>p.metrics.rating!==null && p.metrics.rating_date>=start && p.metrics.rating_date<end);
    const promoters=responses.filter(p=>p.metrics.rating>=9).length, detractors=responses.filter(p=>p.metrics.rating<=6).length;
    const nps = { count:responses.length,promoters,detractors,passives:responses.length-promoters-detractors,
      score:responses.length?Math.round((promoters-detractors)/responses.length*100):null,
      responses:responses.map(p=>({id:p.id,name:p.name,rating:p.metrics.rating,date:p.metrics.rating_date})) };
    const customerCash=new Map();let unknownCash=0;
    for(const entry of entries.filter(e=>e.status==='Recorded' && ['Payment received','Customer refund'].includes(e.type))) {
      const customerId=jobs.find(p=>p.id===entry.project_id)?.metrics.customer_id;
      const amount=entry.type==='Customer refund'?-entry.amount_cents:entry.amount_cents;
      if(customerId) customerCash.set(customerId,(customerCash.get(customerId)||0)+amount); else unknownCash+=amount;
    }
    const sharesValid=totals.received_cents>0 && unknownCash>=0 && [...customerCash.values()].every(n=>n>=0);
    const customerRows=[...customerCash.entries()].map(([id,cents])=>({id,name:customers.find(c=>c.id===id)?.name||'Customer',cents,share:sharesValid?cents/totals.received_cents*100:null})).sort((a,b)=>b.cents-a.cents || a.name.localeCompare(b.name));
    const concentration={ customers:customerRows,unassigned_cents:unknownCash,shares_available:sharesValid,
      top_one:sharesValid&&customerRows.length?customerRows[0].share:null,
      top_three:sharesValid&&customerRows.length?customerRows.slice(0,3).reduce((n,c)=>n+c.cents,0)/totals.received_cents*100:null,
      assigned_percent:sharesValid?(totals.received_cents-unknownCash)/totals.received_cents*100:null };
    return { year,quarter,start,end,today,totals,comparison,profitability,quarters,months,expenses,entries,projects,by_project:byProject,saved,saved_projects:savedProjects,operations,attention,fun,customers,jobs,duration,nps,concentration };
  }
  function save(id, b) {
    if (id && !db.prepare('SELECT id FROM cash_entries WHERE id=?').get(id)) fail(404,'Entry not found.');
    const projectId = b.project_id || null;
    if (projectId !== null && (typeof projectId !== 'string' || !db.prepare('SELECT id FROM projects WHERE id=?').get(projectId))) fail(400,'Choose an existing project.');
    const day = str(b.entry_date,'payment date',10,true);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10)!==day || Number(day.slice(0,4))<2000 || Number(day.slice(0,4))>2100) fail(400,'Enter a valid date between 2000 and 2100.');
    if (day > localDate(new Date().toISOString())) fail(400,'Record money that has already changed hands. Future payments are not actual cash.');
    if (!transactionTypes.includes(b.type)) fail(400,'Choose a valid entry type.');
    if (!categories.includes(b.category)) fail(400,'Choose a valid category.');
    if (!['string','number'].includes(typeof b.amount) || !/^\d+(\.\d{1,2})?$/.test(String(b.amount)) || Number(b.amount)<=0 || Number(b.amount)>10000000) fail(400,'Enter a positive amount, up to $10,000,000 with at most two decimal places.');
    const amount = Math.round(Number(b.amount)*100);
    const description = str(b.description,'description',500,true);
    if (!['Recorded','Voided'].includes(b.status)) fail(400,'Choose Recorded or Voided.');
    const reason = str(b.void_reason ?? '', 'void reason',500);
    if (b.status === 'Voided' && !reason) fail(400,'Explain why the entry is voided.');
    const now = new Date().toISOString();
    const values = [projectId,day,b.type,b.category,amount,description,b.status,reason];
    if (id) {
      const result = db.prepare('UPDATE cash_entries SET project_id=?,entry_date=?,type=?,category=?,amount_cents=?,description=?,status=?,void_reason=?,updated_at=?,revision=revision+1 WHERE id=? AND revision=?').run(...values,now,id,Number(b.revision)||0);
      if (!result.changes) fail(409,'This entry changed on another screen. Refresh and try again.');
    } else db.prepare('INSERT INTO cash_entries(id,project_id,entry_date,type,category,amount_cents,description,status,void_reason,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(randomUUID(),...values,now,now);
  }
  return { report, async handle(req,url,json,send) {
    if (url.pathname === '/api/company' && req.method === 'GET') { send(200,report(url)); return true; }
    const job=url.pathname.match(/^\/api\/company\/jobs\/([\w-]+)$/);
    if(job && req.method==='PUT') {
      const projectId=job[1];
      if(!db.prepare('SELECT id FROM projects WHERE id=?').get(projectId)) fail(404,'Project not found.');
      const b=await json(req), today=localDate(new Date().toISOString());
      const checkDate=(value,label)=>{const d=str(value??'',label,10);if(d && (!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d||d<'2000-01-01'||d>today))fail(400,`Enter a valid ${label}, no later than today.`);return d;};
      const started=checkDate(b.started,'start date'),finished=checkDate(b.finished,'finish date');
      if(finished && (!started||finished<started))fail(400,'Finish date must be on or after the start date.');
      const rating=b.rating===null||b.rating===''||b.rating===undefined?null:b.rating;
      if(rating!==null && (!['number','string'].includes(typeof rating)||!/^\d+$/.test(String(rating))||Number(rating)>10))fail(400,'Customer score must be a whole number from 0 to 10.');
      const ratingDate=checkDate(b.rating_date,'response date');
      if(rating!==null && !ratingDate)fail(400,'Add the date the customer gave this score.');
      if(rating===null && ratingDate)fail(400,'Enter a customer score, or clear the response date.');
      const feedback=str(b.feedback??'','customer feedback',2000);
      const customerName=str(b.new_customer??'','customer name',160);
      let customerId=b.customer_id||null;
      if(customerId && (typeof customerId!=='string'||!db.prepare('SELECT id FROM company_customers WHERE id=?').get(customerId)))fail(400,'Choose a valid customer.');
      if(customerId && customerName)fail(400,'Choose an existing customer or enter a new name, not both.');
      const existing=db.prepare('SELECT revision FROM job_metrics WHERE project_id=?').get(projectId);
      if((existing?.revision||0)!==Number(b.revision))fail(409,'Job details changed on another screen. Refresh and try again.');
      db.exec('BEGIN IMMEDIATE');
      try {
        if(customerName){customerId=db.prepare('SELECT id FROM company_customers WHERE name=?').get(customerName)?.id;if(!customerId){customerId=randomUUID();db.prepare('INSERT INTO company_customers VALUES (?,?)').run(customerId,customerName);}}
        if(existing)db.prepare('UPDATE job_metrics SET customer_id=?,started=?,finished=?,rating=?,rating_date=?,feedback=?,revision=revision+1 WHERE project_id=?').run(customerId,started,finished,rating===null?null:Number(rating),ratingDate,feedback,projectId);
        else db.prepare('INSERT INTO job_metrics(project_id,customer_id,started,finished,rating,rating_date,feedback) VALUES (?,?,?,?,?,?,?)').run(projectId,customerId,started,finished,rating===null?null:Number(rating),ratingDate,feedback);
        db.exec('COMMIT');
      }catch(e){db.exec('ROLLBACK');throw e;}
      send(200,{saved:true});return true;
    }
    const match = url.pathname.match(/^\/api\/company\/entries(?:\/([\w-]+))?$/);
    if (!match) return false;
    const id = match[1];
    if (!((req.method==='POST' && !id) || (req.method==='PUT' && id))) fail(405,'Method not allowed.');
    save(id, await json(req)); send(req.method==='POST'?201:200,{ saved:true }); return true;
  }};
}

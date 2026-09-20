import { randomUUID } from 'node:crypto';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const str=(value,label,max=2000,required=false)=>{
  if(typeof value!=='string' || value.trim().length>max || (required&&!value.trim())) fail(400,`Enter ${label}${required?' (required)':''}, at most ${max} characters.`);
  return value.trim();
};
const choice=(v,list)=>list.includes(v)?v:fail(400,'Choose a valid status or type.');
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function date(v,required=false,past=false){
  if(!v&&!required)return '';
  if(typeof v!=='string'||!/^20\d\d-\d\d-\d\d$/.test(v)||(!Number.isFinite(Date.parse(v+'T12:00:00Z'))||new Date(v+'T12:00:00Z').toISOString().slice(0,10)!==v)||(past&&v>today()))fail(400,'Enter a valid date; recorded work cannot be in the future.');
  return v;
}
function decimal(v,max,label){
  if(!/^\d+(\.\d{1,2})?$/.test(String(v))||Number(v)>max)fail(400,`Enter a valid ${label}, with at most two decimal places.`);
  return Math.round(Number(v)*100);
}
export function operationsStore(db,estimates) {
  db.exec(`CREATE TABLE IF NOT EXISTS operations_records (
    id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),kind TEXT NOT NULL,data TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS operations_project ON operations_records(project_id,kind);
    CREATE INDEX IF NOT EXISTS operations_kind ON operations_records(kind);`);
  const unpack=r=>r?{...JSON.parse(r.data),id:r.id,project_id:r.project_id,revision:r.revision,created_at:r.created_at,updated_at:r.updated_at}:null;
  const rows=(pid,kind)=>db.prepare('SELECT * FROM operations_records WHERE project_id IS ? AND kind=? ORDER BY created_at,id').all(pid,kind).map(unpack);
  const get=(pid,kind,id)=>unpack(db.prepare('SELECT * FROM operations_records WHERE project_id IS ? AND kind=? AND id=?').get(pid,kind,id))||fail(404,'Record not found in this project.');
  function save(pid,kind,id,b,content) {
    const now=new Date().toISOString();
    if(id){get(pid,kind,id);const result=db.prepare('UPDATE operations_records SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(JSON.stringify(content),now,id,Number(b.revision)||0);if(!result.changes)fail(409,'This record changed. Refresh and try again.');}
    else {id=randomUUID();db.prepare('INSERT INTO operations_records VALUES(?,?,?,?,1,?,?)').run(id,pid,kind,JSON.stringify(content),now,now);}
    return get(pid,kind,id);
  }
  const crewSafe=(crew,costs)=>costs?crew:crew.map(({rate_cents,burden_bp,...person})=>person);
  function state(pid,costs=true){
    const findings=rows(pid,'findings'),tasks=rows(pid,'tasks'),assignments=rows(pid,'assignments'),time=rows(pid,'time'),reports=rows(pid,'reports').reverse(),setup=rows(pid,'setup')[0]||null;
    const crew=rows(null,'crew');
    const open=tasks.filter(t=>!['Complete','Cancelled'].includes(t.status));
    const overdue=open.filter(t=>t.due && t.due<today());
    const blocked=open.filter(t=>t.status==='Blocked'||(t.finding_id&&findings.find(f=>f.id===t.finding_id)?.status!=='Confirmed'));
    const lastReport=[...reports].sort((a,b)=>b.date.localeCompare(a.date)||b.created_at.localeCompare(a.created_at))[0];
    const stale=!lastReport || (new Date(today())-new Date(lastReport.date))/86400000>7;
    const scheduled=tasks.some(t=>t.due&&t.status!=='Cancelled');
    const schedule=overdue.length?'Overdue work':blocked.length?'Blocked':stale?'Update needed':!scheduled?'Not assessed':'No overdue work';
    let cost=null;
    if(costs){
      const ledger=db.prepare("SELECT * FROM cash_entries WHERE project_id=? AND status='Recorded' AND type IN ('Expense paid','Supplier refund')").all(pid);
      let expense=0,excludedLabor=0;const categories={};
      for(const e of ledger){const amount=e.amount_cents*(e.type==='Supplier refund'?-1:1);if(e.category==='Labor')excludedLabor+=amount;else {expense+=amount;categories[e.category]=(categories[e.category]||0)+amount;}}
      const approved=time.filter(t=>t.status==='Approved');const labor=approved.reduce((n,t)=>n+t.cost_cents,0);
      const estimate=estimates.state(pid),snapshot=estimate.snapshots[0];
      cost={labor_cents:labor,expense_cents:expense,total_cents:labor+expense,excluded_labor_payments_cents:excludedLabor,
        categories,approved_minutes:approved.reduce((n,t)=>n+t.minutes,0),pending_minutes:time.filter(t=>t.status==='Pending').reduce((n,t)=>n+t.minutes,0),
        baseline:snapshot?{label:snapshot.label,cents:snapshot.total_cents,gaps:snapshot.flag_count}:null,
        remaining_cents:snapshot?snapshot.total_cents-labor-expense:null};
    }
    return {today:today(),findings,tasks,assignments,crew:crewSafe(crew,costs),time:costs?time:time.map(({rate_cents,burden_bp,cost_cents,...entry})=>entry),reports,setup,cost,
      summary:{schedule,overdue:overdue.length,blocked:blocked.length,stale_report:stale,last_report:lastReport?.date||null,open_tasks:open.length,unreviewed:findings.filter(f=>['Needs review','Specialist needed'].includes(f.status)).length},
      recovery:[...overdue.map(t=>`Review the due date and resources for “${t.title}”.`),...blocked.map(t=>`Resolve the blocker or review the source finding for “${t.title}”.`),...(stale?['Request a current progress report from the project manager.']:[])].slice(0,12)};
  }
  return {state,async handle(req,url,project,json,send){
    const actor=req.jobscopesActor||{id:'local-operator',name:'Local operator',role:'Owner'};
    const costs=['Owner','Manager'].includes(actor.role);
    const crewMatch=url.pathname.match(/^\/api\/operations\/crew(?:\/([\w-]+))?$/);
    const match=url.pathname.match(/^\/api\/projects\/([\w-]+)\/operations(?:\/(findings|tasks|assignments|time|reports|setup)(?:\/([\w-]+))?)?$/);
    if(url.pathname==='/api/operations/portfolio'&&req.method==='GET'){send(200,db.prepare('SELECT id,name,status FROM projects').all().map(p=>({...p,...state(p.id,costs)})));return true;}
    if(!match&&!crewMatch)return false;
    const pid=match?.[1]||null,kind=crewMatch?'crew':match[2],id=crewMatch?.[1]||match?.[3];if(pid)project(pid);
    if(req.method==='GET'&&!id){send(200,crewMatch?crewSafe(rows(null,'crew'),costs):state(pid,costs));return true;}
    if(!costs)fail(403,'Only owners and managers can update project operations.');
    if(!['POST','PUT'].includes(req.method)||!kind||(req.method==='PUT')!==Boolean(id))fail(405,'Method not allowed.');
    const b=await json(req),old=id?get(pid,kind,id):null;let content;
    if(old&&Number(b.revision)!==old.revision)fail(409,'This record changed. Refresh and try again.');
    if(kind==='crew')content={name:str(b.name,'worker name',120,true),trade:str(b.trade||'','trade',120),rate_cents:decimal(b.rate,100000,'hourly cost rate'),burden_bp:decimal(b.burden||'0',100,'labor burden percentage'),active:choice(b.active,['Active','Inactive'])};
    if(kind==='assignments'){
      get(null,'crew',b.crew_id);if(old&&old.crew_id!==b.crew_id)fail(400,'A project assignment cannot be transferred to another worker.');if(rows(pid,kind).some(a=>a.crew_id===b.crew_id&&a.id!==id))fail(409,'This worker is already assigned.');
      content={crew_id:b.crew_id,role:str(b.role||'','project responsibility',160)};
    }
    if(kind==='setup'){
      if(!id&&rows(pid,kind).length)fail(409,'Project setup already exists. Refresh and edit it.');
      content={manager:str(b.manager||'','project manager',120),measurements:str(b.measurements||'','measurements and units'),access:str(b.access||'','access and site constraints'),scope:str(b.scope||'','proposed scope',4000)};
    }
    if(kind==='findings'){
      if(b.photo_id&&!db.prepare('SELECT id FROM photos WHERE id=? AND project_id=?').get(b.photo_id,pid))fail(400,'Choose a photo from this project.');
      const status=choice(b.status,['Needs review','Confirmed','Dismissed','Specialist needed']);
      content={title:str(b.title,'finding title',160,true),location:str(b.location||'','site location',200),observation:str(b.observation,'observation',3000,true),uncertainty:str(b.uncertainty||'','uncertainty'),next_step:str(b.next_step||'','next verification step'),photo_id:b.photo_id||null,status,
        review_notes:str(b.review_notes||'','review notes',2000,status!=='Needs review'),reviewed_by:status==='Needs review'?null:actor.name,reviewed_at:status==='Needs review'?null:new Date().toISOString(),source:'Human observation'};
    }
    if(kind==='tasks'){
      const source=old?.finding_id||b.finding_id; const finding=source?get(pid,'findings',source):null;
      if(finding&&finding.status!=='Confirmed'&&(!old||!['Blocked','Cancelled'].includes(b.status)))fail(400,'Confirm the source finding before assigning work from it.');
      if(finding&&rows(pid,kind).some(t=>t.finding_id===finding.id&&t.id!==id))fail(409,'This finding already has a work item. Edit that item instead.');
      if(b.assignee_id&&!rows(pid,'assignments').some(a=>a.crew_id===b.assignee_id))fail(400,'Assign this worker to the project first.');
      const status=choice(b.status,['Planned','In progress','Blocked','Complete','Cancelled']);
      content={title:str(b.title,'work item',160,true),kind:choice(b.kind,['Task','Milestone']),status,due:date(b.due),assignee_id:b.assignee_id||null,finding_id:old?.finding_id||b.finding_id||null,notes:str(b.notes||'','work instructions',3000),blocker:str(b.blocker||'','blocker',2000,status==='Blocked')};
    }
    if(kind==='time'){
      const status=choice(b.status,['Pending','Approved','Voided']);
      if(old&&(old.status!=='Pending'||status==='Voided')){
        if(status!=='Voided'||old.status==='Voided')fail(400,'Approved entries are immutable. Void with a reason and enter a correction.');
        content={...old,status,void_reason:str(b.void_reason,'void reason',500,true),voided_by:actor.name};
      }else{
        const worker=get(null,'crew',b.crew_id);
        if(!rows(pid,'assignments').some(a=>a.crew_id===worker.id)||worker.active!=='Active')fail(400,'Choose an active worker assigned to this project.');
        const minutes=Number(b.minutes);if(!Number.isInteger(minutes)||minutes<1||minutes>1440)fail(400,'Enter 1–1440 whole minutes.');
        const day=date(b.date,true,true);
        const existing=db.prepare("SELECT data,id FROM operations_records WHERE kind='time'").all().filter(r=>r.id!==id).map(r=>JSON.parse(r.data)).filter(t=>t.crew_id===worker.id&&t.date===day&&t.status!=='Voided').reduce((n,t)=>n+t.minutes,0);
        if(status!=='Voided'&&existing+minutes>1440)fail(400,'This worker would exceed 24 hours across projects for this date.');
        const cost=Number((BigInt(minutes)*BigInt(worker.rate_cents)*BigInt(10000+worker.burden_bp)+300000n)/600000n);
        content={crew_id:worker.id,worker_name:worker.name,date:day,minutes,status,notes:str(b.notes||'','work performed',2000,true),void_reason:status==='Voided'?str(b.void_reason,'void reason',500,true):'',
          rate_cents:status==='Approved'?worker.rate_cents:null,burden_bp:status==='Approved'?worker.burden_bp:null,cost_cents:status==='Approved'?cost:null,approved_by:status==='Approved'?actor.name:null,approved_at:status==='Approved'?new Date().toISOString():null};
      }
    }
    if(kind==='reports')content={date:date(b.date,true,true),summary:str(b.summary,'progress summary',3000,true),blockers:str(b.blockers||'','blockers',2000),next_steps:str(b.next_steps||'','next actions',2000),author:actor.name};
    const saved=save(pid,kind,id,b,content);send(old?200:201,saved);return true;
  }};
}

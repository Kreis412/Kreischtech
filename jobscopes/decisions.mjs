import {randomUUID} from 'node:crypto';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function decisionStore(db){
 db.exec(`CREATE TABLE IF NOT EXISTS finding_history(seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL UNIQUE,project_id TEXT NOT NULL,finding_id TEXT NOT NULL,event TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS finding_history_lookup ON finding_history(project_id,finding_id,seq);
 CREATE TRIGGER IF NOT EXISTS finding_history_no_update BEFORE UPDATE ON finding_history BEGIN SELECT RAISE(ABORT,'Finding history is append-only'); END;
 CREATE TRIGGER IF NOT EXISTS finding_history_no_delete BEFORE DELETE ON finding_history BEGIN SELECT RAISE(ABORT,'Finding history is append-only'); END;`);
 const history=(pid,id)=>db.prepare('SELECT * FROM finding_history WHERE project_id=? AND finding_id=? ORDER BY seq').all(pid,id).map(r=>({...JSON.parse(r.data),id:r.id,event:r.event,created_at:r.created_at}));
 function append(pid,id,event,data){const key=randomUUID();db.prepare('INSERT INTO finding_history(id,project_id,finding_id,event,data,created_at) VALUES(?,?,?,?,?,?)').run(key,pid,id,event,JSON.stringify(data),new Date().toISOString());return key;}
 function decorate(f){const events=history(f.project_id,f.id),decision=events.filter(e=>e.event==='Decision').at(-1)||null;const current=decision&&decision.finding_revision===f.revision;
 return {...f,history:events,decision,decision_current:Boolean(current),work_authorized:decision?Boolean(current&&['Proceed','Resolved'].includes(decision.action)):f.status==='Confirmed'};}
 function snapshot(f,actor,event='Finding revised'){append(f.project_id,f.id,event,{snapshot:f,actor_id:actor.id,actor_name:actor.name,actor_role:actor.role});}
 return {decorate,snapshot,async handle(req,url,project,json,send){
 const m=url.pathname.match(/^\/api\/projects\/([\w-]+)\/operations\/findings\/([\w-]+)\/decisions$/);if(!m)return false;
 const [,pid,id]=m;project(pid);const row=db.prepare("SELECT * FROM operations_records WHERE id=? AND project_id=? AND kind='findings'").get(id,pid);if(!row)fail(404,'Finding not found in this project.');
 if(req.method==='GET'){send(200,history(pid,id));return true;}
 const actor=req.jobscopesActor;if(!actor||!['Owner','Manager'].includes(actor.role))fail(403,'Only owners and managers can record decisions.');
 if(req.method!=='POST')fail(405,'Decision history cannot be edited or deleted.');
 const b=await json(req);const fresh=db.prepare('SELECT * FROM operations_records WHERE id=?').get(id);const finding={...JSON.parse(fresh.data),id,project_id:pid,revision:fresh.revision};const view=decorate(finding);
 if(Number(b.finding_revision)!==finding.revision||(b.previous_decision_id||null)!==(view.decision?.id||null))fail(409,'This finding or its decision changed. Refresh before deciding.');
 if(!['Proceed','Resolved','Deferred','Specialist review','Reopened'].includes(b.action))fail(400,'Choose a valid decision.');
 function text(v,label,max=2000,required=false){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(400,`Enter ${label}${required?' (required)':''}.`);return v.trim();}
 const reason=text(b.reason||'','a reason',2000,true),evidence=text(b.evidence||'','supporting evidence'),responsible=text(b.responsible||'','a responsible person',160,b.action==='Deferred');
 const review_date=b.review_date||'';
 if(b.action==='Deferred'&&(!/^20\d\d-\d\d-\d\d$/.test(review_date)||!Number.isFinite(Date.parse(review_date))||new Date(review_date).toISOString().slice(0,10)!==review_date||review_date<new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())))fail(400,'Choose today or a future review date.');
 const photo_id=b.photo_id||null;if(photo_id&&!db.prepare('SELECT id FROM photos WHERE id=? AND project_id=?').get(photo_id,pid))fail(400,'Choose evidence from this project.');
 if(b.action==='Resolved'&&!evidence&&!photo_id)fail(400,'Describe resolution evidence or attach a project photo.');
 const data={action:b.action,reason,evidence,photo_id,responsible:b.action==='Deferred'?responsible:'',review_date:b.action==='Deferred'?review_date:'',finding_revision:finding.revision,snapshot:finding,actor_id:actor.id,actor_name:actor.name,actor_role:actor.role};
 append(pid,id,'Decision',data);send(201,decorate(finding));return true;
 }};
}

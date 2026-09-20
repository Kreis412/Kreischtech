import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {operationsStore} from '../operations.mjs';
test('decisions preserve observations, authorize work and cannot be erased',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);INSERT INTO projects VALUES('a'),('b');CREATE TABLE photos(id TEXT PRIMARY KEY,project_id TEXT);INSERT INTO photos VALUES('other','b'),('evidence','a');CREATE TABLE cash_entries(project_id TEXT,status TEXT,type TEXT);`);
 const ops=operationsStore(db,{state:()=>({snapshots:[]})});
 async function req(path,body,role='Owner',method='POST'){let out;await ops.handle({method,jobscopesActor:{id:'actor-id',name:'Actual owner',role}},new URL('http://localhost/api/projects/'+path),id=>{if(!['a','b'].includes(id))throw Object.assign(Error(),{status:404});},async()=>body,(status,value)=>out={status,value});return out?.value;}
 const f=await req('a/operations/findings',{title:'Reported void',observation:'Contractor reports a void.',status:'Needs review'}),path=`a/operations/findings/${f.id}/decisions`;
 const base={finding_revision:f.revision,previous_decision_id:null,action:'Proceed',reason:'Recorded field judgment',actor_name:'Spoofed'};
 await assert.rejects(req(path,base,'Viewer'),e=>e.status===403);
 await assert.rejects(req(path,{...base,reason:''}),e=>e.status===400);
 await assert.rejects(req(path,{...base,photo_id:'other'}),e=>e.status===400);
 await assert.rejects(req(`b/operations/findings/${f.id}/decisions`,base),e=>e.status===404);
 let view=await req(path,base);assert.equal(view.status,'Needs review');assert.equal(view.work_authorized,true);assert.equal(view.decision.actor_name,'Actual owner');assert.equal(view.decision.snapshot.observation,f.observation);
 const first=view.decision.id;await assert.rejects(req(path,base),e=>e.status===409);
 const task=await req('a/operations/tasks',{title:'Planned work',kind:'Task',status:'Planned',finding_id:f.id});assert.ok(task.id);
 view=await req(path,{...base,previous_decision_id:first,action:'Deferred',responsible:'Project manager',review_date:'2099-01-01'});assert.equal(view.work_authorized,false);assert.equal(ops.state('a').summary.blocked,1);
 await assert.rejects(req('a/operations/tasks/'+task.id,{...task,status:'Complete'},'Owner','PUT'),e=>e.status===400);
 await assert.rejects(req(path,{...base,previous_decision_id:view.decision.id,action:'Resolved'}),e=>e.status===400);
 view=await req(path,{...base,previous_decision_id:view.decision.id,action:'Resolved',evidence:'Recorded verification notes'});assert.equal(view.work_authorized,true);assert.equal(view.status,'Needs review');
 const decisionId=view.decision.id;
 const updated=await req('a/operations/findings/'+f.id,{...f,observation:'New measurement changes concern'},'Owner','PUT');view=ops.state('a').findings[0];assert.equal(view.decision_current,false);assert.equal(view.work_authorized,false);assert.equal(view.history[0].snapshot.observation,f.observation);
 await assert.rejects(req(path,{...base,previous_decision_id:decisionId}),e=>e.status===409);
 view=await req(path,{...base,finding_revision:updated.revision,previous_decision_id:decisionId,action:'Proceed'});assert.equal(view.work_authorized,true);
 await assert.rejects(req(path,{},'Owner','PUT'),e=>e.status===405);
 assert.throws(()=>db.prepare('DELETE FROM finding_history').run(),/append-only/);assert.throws(()=>db.prepare("UPDATE finding_history SET event='changed'").run(),/append-only/);
 assert.equal(view.history.filter(x=>x.event==='Decision').length,4);db.close();
});

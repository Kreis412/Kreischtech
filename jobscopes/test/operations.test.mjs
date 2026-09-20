import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createProduct} from '../server.mjs';
test('connected operations: review, crews, approval, costs, isolation and persistence',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'jobscopes-operations-'));let server,base;
 async function start(){server=createProduct({dataDir:dir});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;}
 async function stop(){await new Promise(r=>{server.close(r);server.closeIdleConnections();});}
 t.after(async()=>{if(server.listening)await stop();rmSync(dir,{recursive:true,force:true});});await start();
 function client(){return {cookie:'',async req(path,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:{Cookie:this.cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))this.cookie=r.headers.get('set-cookie').split(';')[0];const result=await r.json();assert.equal(r.status,status,JSON.stringify(result));return result;}};}
 const a=client(),b=client(),v=client();for(const [c,n] of [[a,'owner'],[b,'other'],[v,'viewer']])await c.req('/api/account/register','POST',{name:n,email:n+'@example.test',password:'test-only long password 2026',company:n},201);
 const p=await a.req('/api/projects','POST',{name:'Music room',type:'Basement',status:'Planning'},201),q=await a.req('/api/projects','POST',{name:'Second job',type:'Basement',status:'Planning'},201),root=`/api/projects/${p.id}/operations`;
 let finding,worker,entry,task;
 await t.test('review is required before scope becomes assigned work',async()=>{
 finding=await a.req(root+'/findings','POST',{title:'Duct clearance',observation:'Low duct',status:'Needs review'},201);
 const work={title:'Verify clearance',kind:'Task',status:'Planned',finding_id:finding.id};
 await a.req(root+'/tasks','POST',work,400);
 finding=await a.req(root+'/findings/'+finding.id,'PUT',{...finding,status:'Confirmed',review_notes:'Measured on site'});
 assert.equal(finding.reviewed_by,'owner');task=await a.req(root+'/tasks','POST',work,201);
 await a.req(root+'/tasks','POST',work,409);
 await a.req(`/api/projects/${q.id}/operations/tasks`,'POST',work,404);
 await a.req(root+'/tasks/'+task.id,'PUT',{...task,due:'2026-99-01'},400);
 await a.req(root+'/findings/'+finding.id,'PUT',{...finding,status:'Specialist needed',review_notes:'Further verification'});
 await a.req(root+'/tasks/'+task.id,'PUT',{...task,finding_id:null,status:'Complete'},400);
 assert.equal((await a.req(root)).summary.blocked,1);
 });
 await t.test('approved time uses a frozen cost rate and burden; daily totals span projects',async()=>{
 worker=await a.req('/api/operations/crew','POST',{name:'Carpenter',trade:'Carpentry',rate:'40',burden:'25',active:'Active'},201);
 for(const id of [p.id,q.id])await a.req(`/api/projects/${id}/operations/assignments`,'POST',{crew_id:worker.id},201);
 entry=await a.req(root+'/time','POST',{crew_id:worker.id,date:'2026-01-01',minutes:120,status:'Pending',notes:'Framing'},201);
 assert.equal((await a.req(root)).cost.total_cents,0);
 entry=await a.req(root+'/time/'+entry.id,'PUT',{...entry,status:'Approved',rate:1});assert.equal(entry.cost_cents,10000);
 await a.req('/api/operations/crew/'+worker.id,'PUT',{...worker,rate:'90',burden:'0'});
 assert.equal((await a.req(root)).cost.labor_cents,10000);
 await a.req(root+'/time/'+entry.id,'PUT',{...entry,minutes:60},400);
 await a.req(`/api/projects/${q.id}/operations/time`,'POST',{crew_id:worker.id,date:'2026-01-01',minutes:1400,status:'Pending',notes:'Too many hours'},400);
 });
 await t.test('running costs exclude payroll payments, include refunds, and have no invented budget',async()=>{
 for(const [category,type,amount] of [['Materials','Expense paid','80'],['Materials','Supplier refund','20'],['Labor','Expense paid','100']])await a.req('/api/company/entries','POST',{project_id:p.id,entry_date:'2026-01-01',category,type,amount,description:'Test cost',status:'Recorded'},201);
 const c=(await a.req(root)).cost;assert.equal(c.total_cents,16000);assert.equal(c.excluded_labor_payments_cents,10000);assert.equal(c.baseline,null);
 await a.req(root+'/reports','POST',{date:'2026-01-01',summary:'Framing started',blockers:'Awaiting review',next_steps:'Verify duct'},201);
 assert.equal((await a.req('/api/operations/portfolio')).length,2);
 });
 await t.test('companies are isolated and viewer cost fields are redacted',async()=>{
 await b.req(root,'GET',undefined,404);assert.deepEqual(await b.req('/api/operations/crew'),[]);
 const company=(await a.req('/api/account/session')).company;
 const invite=await a.req('/api/account/invites','POST',{email:'viewer@example.test',role:'Viewer'},201);await v.req('/api/account/join','POST',{code:invite.code});await v.req('/api/account/switch','POST',{company_id:company.id});
 const d=await v.req(root);assert.equal(d.cost,null);assert.equal('rate_cents' in d.crew[0],false);assert.equal('cost_cents' in d.time[0],false);
 await v.req(root+'/time','POST',{...entry},403);
 });
 await t.test('restart preserves work and voiding reverses approved labor',async()=>{
 await stop();await start();assert.equal((await a.req(root)).cost.total_cents,16000);
 await a.req(root+'/time/'+entry.id,'PUT',{revision:entry.revision,status:'Voided',void_reason:'Duplicate time'});
 assert.equal((await a.req(root)).cost.total_cents,6000);
 await a.req(root+'/time/'+entry.id,'PUT',{revision:entry.revision,status:'Voided',void_reason:'Again'},409);
 });
});

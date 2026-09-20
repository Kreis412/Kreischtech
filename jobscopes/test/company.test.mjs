import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../workspace.mjs';

test('company reporting: cash periods, customers, durations, NPS and honest gaps',async t=>{
  const dataDir=mkdtempSync(join(tmpdir(),'jobscopes-company-'));let server,base;
  async function start(){server=createApp({dataDir});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;}
  async function stop(){await new Promise(resolve=>server.close(resolve));}
  t.after(async()=>{if(server?.listening)await stop();rmSync(dataDir,{recursive:true,force:true});});
  async function req(path,method='GET',value,status=200){const r=await fetch(base+path,{method,...(value===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(value)})});const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b;}
  const report=(quarter='all')=>req('/api/company?year=2024&quarter='+quarter);
  await start();
  const projects=[];
  for(const name of ['First job','Repeat job','Third job','Other job'])projects.push(await req('/api/projects','POST',{name,type:'Basement',status:'Discovery'},201));
  const [a,b,c,d]=projects;
  await t.test('empty state has no invented profit, dates, ratings or concentration',async()=>{
    const r=await report();assert.equal(r.totals.entry_count,0);assert.equal(r.nps.score,null);assert.equal(r.duration.average_days,null);assert.equal(r.concentration.top_one,null);assert.equal(r.saved.project_count,0);assert.equal(r.fun.photo_leader,null);
    await req('/api/company?year=bad','GET',undefined,400);await req('/api/company?quarter=5','GET',undefined,400);
  });
  await t.test('actual dates and NPS validation, account deduplication and revisions',async()=>{
    const profile={new_customer:'Family A',started:'2024-02-28',finished:'2024-03-01',rating:10,rating_date:'2024-03-02',feedback:'Would recommend.',revision:0};
    await req(`/api/company/jobs/${a.id}`,'PUT',profile);
    await req(`/api/company/jobs/${b.id}`,'PUT',{...profile,new_customer:' family a ',started:'2024-03-01',finished:'2024-03-11',rating:8});
    await req(`/api/company/jobs/${c.id}`,'PUT',{...profile,new_customer:'Family B',started:'2024-03-01',finished:'2024-03-01',rating:6});
    const r=await report('1');assert.equal(r.customers.length,2);assert.equal(r.duration.count,3);assert.equal(r.duration.average_days,4);assert.equal(r.duration.median_days,2);assert.equal(r.duration.shortest.days,0);assert.equal(r.duration.longest.days,10);
    assert.deepEqual([r.nps.score,r.nps.count,r.nps.promoters,r.nps.passives,r.nps.detractors],[0,3,1,1,1]);
    await req(`/api/company/jobs/${a.id}`,'PUT',profile,409);
    for(const bad of [{rating:11},{rating:-1},{rating:true},{rating:' '},{rating:9.5},{rating_date:''},{finished:'2024-01-01'},{started:'2024-02-30'},{started:'2099-01-01',finished:''}])await req(`/api/company/jobs/${d.id}`,'PUT',{...profile,...bad},400);
    await req('/api/company/jobs/missing','PUT',profile,404);
    assert.equal((await report('2')).nps.count,0);assert.equal((await report('2')).duration.count,0);
  });
  const entry=(project,amount,type='Payment received',date='2024-03-31')=>({project_id:project,amount,type,entry_date:date,category:'Materials',description:`Test ${type}`,status:'Recorded'});
  await t.test('cash totals, refunds, quarter boundaries and concentration',async()=>{
    for(const [project,amount,type,date] of [[a.id,100],[b.id,200],[c.id,300],[null,100],[a.id,50,'Customer refund'],[a.id,80,'Expense paid'],[a.id,20,'Supplier refund'],[a.id,400,'Payment received','2024-04-01']])await req('/api/company/entries','POST',entry(project,amount,type,date),201);
    const r=await report('1');assert.equal(r.totals.received_cents,65000);assert.equal(r.totals.spent_cents,6000);assert.equal(r.totals.net_cents,59000);
    assert.equal(r.concentration.unassigned_cents,10000);assert.equal(r.concentration.customers.length,2);assert.equal(r.concentration.customers[0].name,'Family B');assert.ok(Math.abs(r.concentration.top_one-300/650*100)<0.0001);assert.ok(Math.abs(r.concentration.top_three-550/650*100)<0.0001);
    const annual=await report();assert.equal(annual.totals.received_cents,105000);assert.equal(annual.quarters[1].received_cents,40000);assert.equal(annual.quarters.reduce((n,q)=>n+q.net_cents,0),annual.totals.net_cents);assert.equal(annual.months.reduce((n,m)=>n+m.net_cents,0),annual.totals.net_cents);
    assert.equal(r.fun.busiest_money_day.count,7);assert.equal(r.fun.project_types.length,1);
  });
  await t.test('cash validation, edits, voiding and refund anomalies',async()=>{
    for(const patch of [{amount:-1},{amount:0},{amount:'1.001'},{amount:true},{entry_date:'2024-02-30'},{entry_date:'2099-01-01'},{project_id:'missing'},{status:'Voided',void_reason:''}])await req('/api/company/entries','POST',{...entry(a.id,1),...patch},400);
    const r=await report('2'),payment=r.entries[0];
    await req(`/api/company/entries/${payment.id}`,'PUT',{...payment,amount:400,status:'Voided',void_reason:'Duplicate entry',revision:payment.revision});
    assert.equal((await report('2')).totals.received_cents,0);
    await req(`/api/company/entries/${payment.id}`,'PUT',{...payment,amount:400},409);
    await req('/api/company/entries','POST',entry(c.id,10,'Customer refund','2024-04-02'),201);
    const anomaly=await report('2');assert.equal(anomaly.totals.received_cents,-1000);assert.equal(anomaly.concentration.shares_available,false);assert.equal(anomaly.concentration.top_one,null);
  });
  await t.test('snapshot revisions do not inflate sales; Eastern dates honor quarter boundary',async()=>{
    let e=await req(`/api/projects/${a.id}/estimate/seed`,'POST',{modules:['general']},201);
    const path=`/api/projects/${a.id}/estimate`;
    e=await req(path+'/snapshots','POST',{label:'March estimate',token:e.token},201);const one=e.snapshots[0].id;
    e=await req(path+'/snapshots','POST',{label:'March revision',token:e.token},201);const two=e.snapshots[0].id;
    e=await req(path+'/snapshots','POST',{label:'April revision',token:e.token},201);const three=e.snapshots[0].id;
    const db=new DatabaseSync(join(dataDir,'contractoros.sqlite'));
    db.prepare('UPDATE estimate_snapshots SET created_at=? WHERE id=?').run('2024-03-01T12:00:00.000Z',one);
    db.prepare('UPDATE estimate_snapshots SET created_at=? WHERE id=?').run('2024-04-01T03:59:00.000Z',two);
    db.prepare('UPDATE estimate_snapshots SET created_at=? WHERE id=?').run('2024-04-01T04:00:00.000Z',three);db.close();
    const q1=await report('1'),q2=await report('2'),annual=await report();
    assert.equal(q1.saved.project_count,1);assert.equal(q1.saved_projects[0].label,'March revision');assert.equal(q2.saved_projects[0].label,'April revision');assert.equal(annual.saved.project_count,1);assert.equal(annual.saved.incomplete_count,1);
    const item=e.items[0];await req(path+'/items/'+item.id,'PUT',{...item,status:'Included',unit_price:null});
    const gaps=await report();assert.equal(gaps.operations.unpriced_included,1);assert.equal(gaps.operations.new_included_count,1);assert.equal(gaps.operations.new_included_unpriced,1);
  });
  await t.test('report values persist after restart',async()=>{
    const before=await report();await stop();await start();const after=await report();assert.deepEqual(after,before);
  });
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {appointments} from '../appointments.mjs';
import {accessPolicy} from '../access.mjs';
import {createProduct} from '../server.mjs';
import {once} from 'node:events';
test('booking HTTP flow works anonymously while management requires an authenticated company',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'cs-booking-http-')),server=createProduct({dataDir:dir});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;let cookie='';const call=(path,method='GET',body,headers={})=>fetch(base+path,{method,headers:{origin:base,'Content-Type':'application/json',cookie,...headers},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await call('/booking.html')).status,200);assert.equal((await call('/api/appointments')).status,401);
 const registered=await call('/api/account/register','POST',{name:'Test',company:'Test builders',email:'booking@example.test',password:'Test-only-password-71923!'});assert.equal(registered.status,201);cookie=registered.headers.get('set-cookie').split(';')[0];
 const settingResponse=await call('/api/appointments/settings','PUT',{enabled:true,name:'Test builders',timezone:'America/New_York',days:[0,1,2,3,4,5,6],open:'09:00',close:'17:00',duration:60,buffer:30});assert.equal(settingResponse.status,200);const settings=await settingResponse.json(),date=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 const anonymousHeaders={'X-Booking-Token':settings.token,cookie:''};const slots=await(await call('/api/booking?date='+date,'GET',undefined,anonymousHeaders)).json();assert.ok(slots.slots.length);
 const requested=await call('/api/booking','POST',{name:'Customer',email:'customer@example.test',phone:'',address:'123 Main St',description:'Estimate',date,start:slots.slots[0].start,request_key:'http-request-key-123456'},anonymousHeaders);assert.equal(requested.status,201);const receipt=await requested.json();
 const list=await(await call('/api/appointments')).json();assert.equal(list[0].status,'pending');assert.equal((await call('/api/appointments/'+list[0].id,'PUT',{status:'approved',revision:1})).status,200);
 const status=await(await call('/api/booking/status','GET',undefined,{'X-Booking-Token':receipt.token,cookie:''})).json();assert.equal(status.status,'approved');assert.equal(status.address,undefined);
});
test('appointment requests require approval, isolate companies, persist, deduplicate and prevent confirmed conflicts',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cs-booking-')),now=()=>Date.parse('2026-10-19T10:00Z');let app=appointments(dir,{now});const owner={company_id:'a',role:'Owner'},other={company_id:'b',role:'Owner'};
 const config={enabled:true,name:'Builders',timezone:'America/New_York',days:[1,2,3,4,5],open:'09:00',close:'17:00',duration:60,buffer:30};
 try{
  assert.throws(()=>app.settings({...owner,role:'Viewer'},config),e=>e.status===403);
  const saved=app.settings(owner,config);assert.equal(saved.token.length,32);assert.equal(app.settings(owner,config).token,saved.token);
  const publicData=app.publicView(saved.token,'2026-10-20');assert.equal(publicData.company,undefined);const start=publicData.slots[0].start;assert.equal(new Date(start).toISOString(),'2026-10-20T13:00:00.000Z');
  const body={name:'Customer',email:'customer@example.com',phone:'',address:'123 Main',description:'Estimate visit',date:'2026-10-20',start,request_key:'unique-key-123456789'};
  const first=app.request(saved.token,body);assert.equal(first.status,'pending');assert.deepEqual(app.request(saved.token,body),first);assert.equal(app.list(owner).length,1);assert.equal(app.publicStatus(first.token).email,undefined);
  const firstId=app.list(owner)[0].id;const second=app.request(saved.token,{...body,request_key:'another-key-12345678'});let rows=app.list(owner).sort((a,b)=>a.id===firstId?-1:b.id===firstId?1:0);assert.equal(rows.length,2);assert.equal(app.list(other).length,0);
  assert.throws(()=>app.update(other,rows[0].id,{status:'approved',revision:1}),e=>e.status===404);
  app.update(owner,rows[0].id,{status:'approved',revision:1});assert.equal(app.publicStatus(first.token).status,'approved');
  assert.throws(()=>app.update(owner,rows[1].id,{status:'approved',revision:1}),e=>e.status===409);
  assert.throws(()=>app.update(owner,rows[0].id,{status:'canceled',revision:1}),e=>e.status===409);
  assert.equal(app.publicView(saved.token,'2026-10-20').slots.some(s=>s.start===start),false);
  app.update(owner,rows[0].id,{status:'canceled',revision:2});app.update(owner,rows[1].id,{status:'approved',revision:1});assert.equal(app.publicStatus(second.token).status,'approved');
  app.close();app=appointments(dir,{now});assert.equal(app.list(owner).length,2);assert.equal(app.publicStatus(second.token).status,'approved');
  app.settings(owner,{...config,enabled:false});assert.throws(()=>app.request(saved.token,{...body,request_key:'third-request-123456'}),e=>e.status===404);assert.equal(app.publicStatus(first.token).status,'canceled');
 }finally{app.close();rmSync(dir,{recursive:true,force:true});}
});
test('booking validates dates, time zones, input and DST, and guards external writes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cs-booking-')),app=appointments(dir,{now:()=>Date.parse('2026-10-19T10:00Z')}),s={company_id:'a',role:'Manager'};
 const b={enabled:true,name:'Builders',timezone:'America/New_York',days:[0,1,2,3,4,5,6],open:'09:00',close:'17:00',duration:60,buffer:0};
 try{assert.throws(()=>app.settings(s,{...b,timezone:'bogus'}),e=>e.status===400);assert.throws(()=>app.settings(s,{...b,open:'29:00'}),e=>e.status===400);const c=app.settings(s,b);
  assert.throws(()=>app.publicView(c.token,'2026-02-30'),e=>e.status===400);assert.throws(()=>app.publicView(c.token,'2028-01-01'),e=>e.status===400);
  assert.equal(new Date(app.publicView(c.token,'2026-11-02').slots[0].start).toISOString(),'2026-11-02T14:00:00.000Z');
  const policy=accessPolicy('https://example.com');assert.doesNotThrow(()=>policy.guard({method:'GET',url:'/booking.html',headers:{host:'example.com','x-forwarded-proto':'https','sec-fetch-site':'cross-site'}}));assert.throws(()=>policy.guard({method:'POST',url:'/api/booking',headers:{host:'example.com','x-forwarded-proto':'https',origin:'https://evil.test'}}),e=>e.status===403);
 }finally{app.close();rmSync(dir,{recursive:true,force:true});}
});

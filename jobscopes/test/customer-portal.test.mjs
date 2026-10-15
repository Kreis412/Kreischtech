import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {customerPortal} from '../customer-portal.mjs';
import {isPublicEntryNavigation,accessPolicy} from '../access.mjs';
test('customer publication isolates tenants, allowlists fields and photos, keeps links and supports revocation',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cs-customer-'));let time=Date.now();
 for(const company of ['a','b']){const folder=join(dir,'companies',company);mkdirSync(folder,{recursive:true});const db=new DatabaseSync(join(folder,'contractoros.sqlite'));db.exec("CREATE TABLE projects(id TEXT,notes TEXT);CREATE TABLE photos(id TEXT,project_id TEXT,content BLOB,mime TEXT);INSERT INTO projects VALUES('p','private financial notes'),('other','private');INSERT INTO photos VALUES('yes','p',X'0102','image/png'),('no','other',X'03','image/png');");db.close();}
 const portal=customerPortal(dir,{now:()=>time}),owner={company_id:'a',role:'Owner'},other={company_id:'b',role:'Owner'},viewer={...owner,role:'Viewer'};
 const body={title:'Addition',status:'In progress',progress:40,update:'Framing underway',milestones:'Next: inspection',completion:'Next month',photos:['yes'],notes:'must not leak',cost:1000};
 try{
  assert.throws(()=>portal.publish(viewer,'p',body),e=>e.status===403);
  assert.throws(()=>portal.status(viewer,'p'),e=>e.status===403);
  assert.throws(()=>portal.publish(owner,'p',{...body,photos:['no']}),e=>e.status===400);
  assert.throws(()=>portal.publish(owner,'p',{...body,progress:101}),e=>e.status===400);
  const first=portal.publish(owner,'p',body);assert.equal(first.token.length,43);
  const publicData=portal.read(first.token);assert.equal(publicData.title,'Addition');assert.equal(publicData.cost,undefined);assert.equal(publicData.notes,undefined);assert.equal(publicData.company,undefined);
  assert.deepEqual([...portal.read(first.token,'yes').content],[1,2]);assert.throws(()=>portal.read(first.token,'no'),e=>e.status===404);
  assert.equal(portal.status(other,'p').active,false);
  const profile={enabled:true,name:'My company',description:'Past work',photos:[{id:'no',caption:'Finished deck'}],cost:100};
  assert.equal(portal.read(first.token).company_profile,null);
  assert.throws(()=>portal.profile(viewer,profile),e=>e.status===403);
  assert.throws(()=>portal.profile(viewer),e=>e.status===403);
  assert.throws(()=>portal.profile(owner,{...profile,photos:[{id:'missing',caption:''}]}),e=>e.status===400);
  assert.throws(()=>portal.profile(owner,{...profile,photos:[null]}),e=>e.status===400);
  assert.throws(()=>portal.profile(owner,{...profile,photos:Array(7).fill({id:'no',caption:''})}),e=>e.status===400);
  portal.profile(owner,profile);assert.equal(portal.profile(other).enabled,false);
  assert.deepEqual(portal.read(first.token).company_profile,{name:'My company',description:'Past work',photos:[{id:'no',caption:'Finished deck'}]});
  assert.deepEqual([...portal.read(first.token,'no').content],[3]);
  portal.profile(owner,{...profile,enabled:false});assert.equal(portal.read(first.token).company_profile,null);assert.throws(()=>portal.read(first.token,'no'),e=>e.status===404);
  portal.profile(owner,{...profile,photos:[]});assert.throws(()=>portal.read(first.token,'no'),e=>e.status===404);
  assert.equal(portal.publish(owner,'p',{...body,update:'Updated',photos:[]}).token,null);
  assert.equal(portal.read(first.token).update,'Updated');assert.throws(()=>portal.read(first.token,'yes'),e=>e.status===404);
  portal.customerMessage(first.token,'Hello');portal.contractorMessage(owner,'p','Reply');assert.deepEqual(portal.read(first.token).messages.map(m=>m.sender),['Customer','Contractor']);assert.equal(portal.status(other,'p').messages.length,0);
  assert.throws(()=>portal.contractorMessage(viewer,'p','No'),e=>e.status===403);
  assert.throws(()=>portal.customerMessage(first.token,'x'.repeat(2001)),e=>e.status===400);
  for(let i=0;i<3;i++)portal.customerMessage(first.token,'Again');assert.throws(()=>portal.customerMessage(first.token,'Too many'),e=>e.status===429);
  const replacement=portal.publish(owner,'p',{...body,replace_link:true});assert.throws(()=>portal.read(first.token),e=>e.status===404);assert.equal(portal.read(replacement.token).messages.length,5);
  portal.revoke(owner,'p');assert.throws(()=>portal.read(replacement.token),e=>e.status===404);assert.throws(()=>portal.customerMessage(replacement.token,'No'),e=>e.status===404);
  const last=portal.publish(owner,'p',body);time+=91*86400000;assert.throws(()=>portal.read(last.token),e=>e.status===404);
 }finally{portal.close();rmSync(dir,{recursive:true,force:true});}
});
test('external customer document navigation is permitted without relaxing API origin checks',()=>{
 const req={method:'GET',url:'/customer.html',headers:{host:'example.com','x-forwarded-proto':'https','sec-fetch-site':'cross-site'}};
 assert.equal(isPublicEntryNavigation(req),true);const policy=accessPolicy('https://example.com');assert.doesNotThrow(()=>policy.guard(req));
 assert.throws(()=>policy.guard({...req,url:'/api/customer'}),e=>e.status===403);
 assert.throws(()=>policy.guard({...req,method:'POST',url:'/api/customer/messages'}),e=>e.status===403);
});

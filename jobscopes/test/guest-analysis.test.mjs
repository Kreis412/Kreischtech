import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {guestAnalysis} from '../guest-analysis.mjs';

function fixture(t,{analyze=async()=>({summary:'A sample review.',findings:[]}),now=()=>Date.UTC(2026,9,22)}={}){
 const dataDir=mkdtempSync(join(tmpdir(),'cs-guest-'));
 const service=guestAnalysis(dataDir,{now,cloud:{status:()=>({remaining_attempts:5}),analyze}});
 t.after(()=>{service.close();rmSync(dataDir,{recursive:true,force:true});});
 return service;
}
const body={photo:'data:image/jpeg;base64,YWJj',description:'Replace the old walkway.',cloud_consent:true};

test('guest photo is sent for one review, then the browser allowance is exhausted',async t=>{
 let calls=0,received;const service=fixture(t,{analyze:async(...args)=>{calls++;received=args;return {summary:'A path is visible.',findings:[]};}});
 const initial=service.status({headers:{}}),request={headers:{cookie:'cs_demo='+initial.cookie}};
 assert.equal(initial.available,true);
 const result=await service.analyze(request,body);
 assert.equal(result.summary,'A path is visible.');assert.equal(calls,1);assert.equal(received[0].toString(),'abc');assert.match(received[1],/Replace the old walkway/);assert.match(received[2],/single free guest preview/);
 assert.equal(service.status(request).used,true);assert.equal(service.status(request).available,false);
 await assert.rejects(service.analyze(request,body),e=>e.status===429);assert.equal(calls,1);
});

test('missing consent and invalid photos do not consume the free try',async t=>{
 const service=fixture(t),initial=service.status({headers:{}}),request={headers:{cookie:'cs_demo='+initial.cookie}};
 await assert.rejects(service.analyze(request,{...body,cloud_consent:false}),e=>e.status===400);
 await assert.rejects(service.analyze(request,{...body,photo:'not-a-photo'}),e=>e.status===400);
 assert.equal(service.status(request).available,true);
});

test('a provider failure consumes the one-attempt trial to prevent repeat paid calls',async t=>{
 let calls=0;const service=fixture(t,{analyze:async()=>{calls++;throw Object.assign(new Error('provider unavailable'),{status:503});}}),initial=service.status({headers:{}}),request={headers:{cookie:'cs_demo='+initial.cookie}};
 await assert.rejects(service.analyze(request,body),/provider unavailable/);
 assert.equal(service.status(request).used,true);await assert.rejects(service.analyze(request,body),e=>e.status===429);assert.equal(calls,1);
});

test('guest previews have a small monthly service-wide cap',async t=>{
 const service=fixture(t);
 for(let i=0;i<5;i++){
  const session=service.status({headers:{}}),request={headers:{cookie:'cs_demo='+session.cookie}};
  assert.equal(session.available,true);await service.analyze(request,body);
 }
 const sixth=service.status({headers:{}}),request={headers:{cookie:'cs_demo='+sixth.cookie}};
 assert.equal(sixth.available,false);await assert.rejects(service.analyze(request,body),e=>e.status===429);
});

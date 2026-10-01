import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {billingStore,billingPreview} from '../billing.mjs';
import {createProduct} from '../server.mjs';

test('credit balances are isolated, durable, reserved atomically and refunded once',t=>{
 const dir=mkdtempSync(join(tmpdir(),'cs-billing-'));let now=1000;
 let a=billingStore(dir,{now:()=>now});const b=billingStore(dir,{now:()=>now});
 t.after(()=>{a.close();b.close();rmSync(dir,{recursive:true,force:true});});
 const grant={id:'stripe:invoice1',company:'one',amount:2,expires:2000};
 assert.equal(a.grant(grant),true);assert.equal(b.grant(grant),false);
 assert.throws(()=>a.grant({...grant,company:'two'}),{status:409});
 assert.equal(a.balance('two'),0);
 a.reserve('one','request1');b.reserve('one','request2');
 assert.throws(()=>b.reserve('one','request3'),{status:429});
 assert.throws(()=>a.reserve('one','request1'),{status:409});
 assert.throws(()=>a.settle('two','request1',false),{status:404});
 a.settle('one','request1',false);assert.equal(b.balance('one'),1);
 assert.equal(b.settle('one','request1',false),false);
 assert.throws(()=>a.settle('one','request1',true),{status:409});
 a.settle('one','request2',true);assert.equal(a.balance('one'),1);
 a.close();a=billingStore(dir,{now:()=>now});assert.equal(a.balance('one'),1);
 assert.throws(()=>a.reserve('one','joe1','joe'),{status:429});
 now=2000;assert.equal(a.balance('one'),0);
});

test('renewals add only their own allowance and oldest credits are used first',t=>{
 const dir=mkdtempSync(join(tmpdir(),'cs-renewal-'));let now=1;
 const store=billingStore(dir,{now:()=>now});t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 store.grant({id:'pack',company:'one',amount:10,expires:100});
 store.grant({id:'month1',company:'one',amount:20,expires:10});
 store.reserve('one','first');store.settle('one','first',true);
 now=10;assert.equal(store.balance('one'),10);
 store.grant({id:'month2',company:'one',amount:20,expires:20});
 assert.equal(store.balance('one'),30);
 assert.throws(()=>store.grant({id:'bad',company:'one',amount:-1,expires:100}),{status:400});
});

test('pricing preview needs sign-in and cannot accept purchases or company grants',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'cs-billing-api-'));const server=createProduct({dataDir:dir});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(r=>{server.close(r);server.closeIdleConnections();});rmSync(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(base+'/api/billing')).status,401);
 const r=await fetch(base+'/api/account/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'billing@example.test',password:'billing test password 2026',name:'Test',company:'Test'})});
 assert.equal(r.status,201);const headers={cookie:r.headers.get('set-cookie').split(';')[0],'content-type':'application/json'};
 const data=await (await fetch(base+'/api/billing',{headers})).json();
 assert.deepEqual(data,billingPreview());assert.equal(data.checkout_enabled,false);
 assert.deepEqual(data.plans.map(p=>p.price_cents),[1900,3900,1000]);
 assert.equal((await fetch(base+'/api/billing',{method:'POST',headers,body:JSON.stringify({company:'other',plan:'crew',credits:999})})).status,405);
 assert.equal((await fetch(base+'/billing.js')).status,200);
});

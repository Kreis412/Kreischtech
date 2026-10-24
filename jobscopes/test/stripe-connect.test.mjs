import {test} from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {stripeConnect} from '../stripe-connect.mjs';
import {createProduct} from '../server.mjs';

const owner={company_id:'company-a',user_id:'user-a',email:'owner@example.test',role:'Owner'};
const other={...owner,company_id:'company-b'},manager={...owner,role:'Manager'},viewer={...owner,role:'Viewer'};
const key='sk_test_unit_connect',secret='whsec_unit_connect',accountSecret='whsec_unit_accounts';
function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'cs-connect-')),sdk=new Stripe(key),cache=new Map(),accounts=new Map(),invoices=new Map(),calls=[];
 let time=Date.now(),active=true,failNext='',count=0;
 const once=async(kind,params,opts,make)=>{calls.push({kind,params:structuredClone(params),opts});const k=opts?.idempotencyKey||randomUUID();if(!cache.has(k))cache.set(k,make());const result=cache.get(k);if(failNext===kind){failNext='';throw new Error('lost Stripe response');}return structuredClone(result);};
 const scoped=opts=>{assert.match(opts?.stripeAccount||'',/^acct_/);return opts.stripeAccount;};
 const client={webhooks:sdk.webhooks,parseEventNotification:sdk.parseEventNotification.bind(sdk),v2:{core:{accounts:{create:(params,opts)=>once('account',params,opts,()=>{const a={id:'acct_'+(++count),livemode:false,...params};accounts.set(a.id,a);return a;}),retrieve:async id=>{const a=accounts.get(id);assert.ok(a);return {...a,configuration:{merchant:{capabilities:{card_payments:{status:active?'active':'pending'}}}}};}},accountLinks:{create:async params=>{calls.push({kind:'link',params});return {url:'https://connect.stripe.com/setup/test'};}}}},
  customers:{create:(params,opts)=>{scoped(opts);return once('customer',params,opts,()=>({id:'cus_'+(++count),livemode:false,...params}));}},
  invoices:{create:(params,opts)=>{const account=scoped(opts);return once('invoice',params,opts,()=>{const inv={id:'in_'+(++count),livemode:false,status:'draft',amount_due:0,amount_paid:0,account,...params};invoices.set(inv.id,inv);return inv;});},retrieve:async(id,opts)=>{assert.equal(invoices.get(id)?.account,scoped(opts));return structuredClone(invoices.get(id));},
   finalizeInvoice:(id,params,opts)=>once('finalize',{id,...params},opts,()=>{const inv=invoices.get(id);assert.equal(inv.account,scoped(opts));inv.status='open';inv.hosted_invoice_url='https://invoice.stripe.com/i/'+id;return inv;}),
   sendInvoice:(id,params,opts)=>once('send',{id,...params},opts,()=>{const inv=invoices.get(id);assert.equal(inv.account,scoped(opts));return inv;})},
  invoiceItems:{create:(params,opts)=>{assert.equal(invoices.get(params.invoice)?.account,scoped(opts));return once('item',params,opts,()=>{invoices.get(params.invoice).amount_due+=params.amount;return {id:'ii_'+(++count),...params};});}}};
 const options={dataDir:dir,origin:'https://example.test',enabled:true,mode:'sandbox',secretKey:key,webhookSecret:secret,accountWebhookSecret:accountSecret,client,now:()=>time,projectExists:(company,p)=>p==='project-'+company};
 let service=stripeConnect(options);const cleanups=[];
 t.after(async()=>{for(const cleanup of cleanups)await cleanup();service.close();rmSync(dir,{recursive:true,force:true});});
 const body=(s=owner)=>({request_id:randomUUID(),project_id:'project-'+s.company_id,customer:{name:'Customer <name>',email:'customer@example.test'},items:[{description:'Deposit',quantity:2,unit_amount:12500},{description:'Materials',quantity:1,unit_amount:4500}],days_until_due:30});
 const event=async(type,invoice,extra={},signing=secret,kind='invoices')=>{const id='evt_'+randomUUID();const payload=kind==='accounts'?{id,object:'v2.core.event',type,created:new Date().toISOString(),livemode:false,related_object:{id:extra.related_object?.id||'acct_test',type:'v2.core.account',url:'/v2/core/accounts/'+(extra.related_object?.id||'acct_test')},...extra}:{id,type,livemode:false,account:invoice?.account,data:{object:invoice},...extra};const raw=JSON.stringify(payload);const sig=sdk.webhooks.generateTestHeaderString({payload:raw,secret:signing});return service.webhook(Buffer.from(raw),sig,kind);};
 return {dir,client,options,accounts,invoices,calls,body,event,cleanup:fn=>cleanups.push(fn),get service(){return service;},get time(){return time;},advance:ms=>time+=ms,setActive:value=>active=value,fail:kind=>failNext=kind,restart:()=>{service.close();service=stripeConnect(options);}};
}
test('sandbox and live credentials fail closed independently of existing billing',t=>{
 const f=fixture(t);for(const overrides of [{enabled:false},{secretKey:'sk_live_example'},{mode:'live',secretKey:'sk_live_example'},{origin:'http://example.test'},{webhookSecret:''},{mode:'typo'}]){const x=stripeConnect({...f.options,...overrides});assert.equal(x.ready,false);x.close();}
 assert.equal(f.service.ready,true);
});
test('hosted Accounts v2 onboarding uses full dashboard, Stripe fees/losses and durable company mapping',async t=>{
 const f=fixture(t);f.fail('account');await assert.rejects(f.service.onboarding(owner),{status:502});f.restart();
 await Promise.all([f.service.onboarding(owner),f.service.onboarding(owner)]);
 assert.equal(f.accounts.size,1);const a=[...f.accounts.values()][0];assert.equal(a.dashboard,'full');assert.deepEqual(a.defaults.responsibilities,{fees_collector:'stripe',losses_collector:'stripe'});
 assert.equal(a.configuration.merchant.capabilities.card_payments.requested,true);
 const link=f.calls.find(c=>c.kind==='link').params;assert.equal(link.use_case.account_onboarding.return_url,'https://example.test/invoicing.html?returned=1');
 assert.equal((await f.service.status(owner)).active,true);await f.service.onboarding(other);assert.equal(f.accounts.size,2);
 await assert.rejects(f.service.onboarding(manager),{status:403});await assert.rejects(f.service.onboarding(viewer),{status:403});
});
test('direct invoice, customer and attached line items have zero platform fee and exclude pending items',async t=>{
 const f=fixture(t);await f.service.onboarding(owner);const result=await f.service.create(owner,f.body());
 assert.equal(result.status,'draft');assert.equal(result.amount_due,29500);assert.equal(result.complete,true);assert.equal(result.url,null);
 const create=f.calls.find(c=>c.kind==='invoice');assert.equal(create.params.application_fee_amount,0);assert.equal(create.params.auto_advance,false);assert.equal(create.params.collection_method,'send_invoice');assert.equal(create.params.pending_invoice_items_behavior,'exclude');
 assert.equal(create.params.transfer_data,undefined);assert.equal(create.opts.stripeAccount,[...f.accounts.keys()][0]);
 for(const c of f.calls.filter(c=>c.kind==='item')){assert.equal(c.params.invoice,[...f.invoices.keys()][0]);assert.equal(c.opts.stripeAccount,create.opts.stripeAccount);}
 assert.equal(f.service.list(manager).length,1);assert.throws(()=>f.service.list(viewer),{status:403});
});
test('customer, draft and item response loss can resume after restart without duplicate charges/items',async t=>{
 for(const kind of ['customer','invoice','item']){
  const f=fixture(t);await f.service.onboarding(owner);const body=f.body();f.fail(kind);await assert.rejects(f.service.create(owner,body),{status:502});
  const pending=f.service.list(owner)[0];assert.equal(pending.complete,false);await assert.rejects(f.service.action(owner,pending.id,'finalize'),{status:409});
  f.restart();const result=await f.service.resume(owner,pending.id);assert.equal(result.amount_due,29500);assert.equal(f.invoices.size,1);
  assert.equal((await f.service.create(owner,body)).id,result.id);assert.equal(f.service.list(owner).length,1);
  await assert.rejects(f.service.create(owner,{...body,days_until_due:10}),{status:409});
 }
});
test('owners cannot select another company account, project, invoice or override fee/transfer fields',async t=>{
 const f=fixture(t);await f.service.onboarding(owner);await f.service.onboarding(other);const inv=await f.service.create(owner,{...f.body(),stripe_account:'acct_attacker',application_fee_amount:5000,transfer_data:{destination:'acct_attacker'}});
 assert.deepEqual(f.service.list(other),[]);await assert.rejects(f.service.action(other,inv.id,'sync'),{status:404});
 await assert.rejects(f.service.create(other,{...f.body(),project_id:'project-company-a'}),{status:404});
 for(const role of ['Manager','Viewer','Worker'])await assert.rejects(f.service.create({...owner,role},f.body()),{status:403});
 assert.equal(f.calls.find(c=>c.kind==='invoice').params.application_fee_amount,0);
});
test('unready account and invalid invoice data cannot create invoices',async t=>{
 const f=fixture(t);await f.service.onboarding(owner);f.setActive(false);await assert.rejects(f.service.create(owner,f.body()),{status:409});f.setActive(true);
 for(const override of [{request_id:'bad'},{items:[]},{items:[{description:'x',quantity:1,unit_amount:-1}]},{items:[{description:'x',quantity:2.5,unit_amount:1}]},{items:[{description:'x',quantity:10000,unit_amount:99999999}]},{days_until_due:0},{customer:{name:'x',email:'bad'}}])await assert.rejects(f.service.create(owner,{...f.body(),...override}),{status:400});
 assert.equal(f.invoices.size,0);
});
test('finalization/share and send are explicit, idempotent and recover lost responses',async t=>{
 const f=fixture(t);await f.service.onboarding(owner);const inv=await f.service.create(owner,f.body());
 await assert.rejects(f.service.action(owner,inv.id,'send'),{status:409});
 f.fail('finalize');await assert.rejects(f.service.action(owner,inv.id,'finalize'),{status:502});f.restart();
 const open=await f.service.action(owner,inv.id,'finalize');assert.equal(open.status,'open');assert.match(open.url,/^https:\/\/invoice.stripe.com\//);
 f.fail('send');await assert.rejects(f.service.action(owner,inv.id,'send'),{status:502});f.restart();
 assert.equal((await f.service.action(owner,inv.id,'send')).sent,true);const sends=f.calls.filter(c=>c.kind==='send').length;
 await f.service.action(owner,inv.id,'send');assert.equal(f.calls.filter(c=>c.kind==='send').length,sends);
});
test('verified Connect webhooks isolate tenants, deduplicate, use current Stripe state and survive restart',async t=>{
 const f=fixture(t);await f.service.onboarding(owner);await f.service.onboarding(other);const inv=await f.service.create(owner,f.body());await f.service.action(owner,inv.id,'finalize');
 const remote=f.invoices.values().next().value;remote.status='paid';remote.amount_paid=remote.amount_due;
 await assert.rejects(f.service.webhook(Buffer.from('{}'),'bad'),{status:400});
 const payload={...remote,status:'open',amount_paid:0};
 await f.event('invoice.paid',payload,{account:[...f.accounts.keys()][1]});assert.equal(f.service.list(owner)[0].status,'open');
 await f.event('invoice.paid',payload,{account:undefined});assert.equal(f.service.list(owner)[0].status,'open');
 await f.event('invoice.paid',payload,{livemode:true});assert.equal(f.service.list(owner)[0].status,'open');
 await f.event('invoice.paid',payload,{id:'evt_repeat'});assert.equal(f.service.list(owner)[0].status,'paid');assert.equal(f.service.list(owner)[0].amount_paid,29500);
 f.restart();await f.event('invoice.updated',payload,{id:'evt_repeat'});await f.event('invoice.payment_failed',payload);assert.equal(f.service.list(owner)[0].status,'paid');
 assert.deepEqual(f.service.list(other),[]);
});
test('webhook failures are retried, invoice ownership and safe hosted URLs are enforced',async t=>{
 const f=fixture(t);await f.service.onboarding(owner);const inv=await f.service.create(owner,f.body()),remote=f.invoices.values().next().value;
 const original={...remote.metadata};remote.metadata.contractorsight_company='company-b';await assert.rejects(f.event('invoice.paid',remote,{id:'evt_retry'}),{status:409});
 remote.metadata=original;remote.status='paid';remote.hosted_invoice_url='https://evil.example/invoice';await assert.rejects(f.event('invoice.paid',remote,{id:'evt_retry'}),{status:502});
 remote.hosted_invoice_url='https://invoice.stripe.com/i/test';await f.event('invoice.paid',remote,{id:'evt_retry'});assert.equal(f.service.list(owner)[0].status,'paid');
 remote.application_fee_amount=10;await assert.rejects(f.service.action(owner,inv.id,'sync'),{status:409});
});
test('stale unresolved requests stop before Stripe prunes idempotency keys; disconnect blocks actions',async t=>{
 const f=fixture(t);await f.service.onboarding(owner);f.fail('item');await assert.rejects(f.service.create(owner,f.body()),{status:502});const pending=f.service.list(owner)[0];f.advance(24*3600000);
 await assert.rejects(f.service.resume(owner,pending.id),{status:409});
 await f.event('account.application.deauthorized',null,{account:[...f.accounts.keys()][0]});assert.equal((await f.service.status(owner)).disconnected,true);
 await assert.rejects(f.service.onboarding(owner),{status:409});await assert.rejects(f.service.create(owner,f.body()),{status:409});
});
test('v2 signed account events update readiness without affecting the subscription ledger',async t=>{
 const f=fixture(t);await f.service.onboarding(owner);f.setActive(false);
 await assert.rejects(f.event('v2.core.account[configuration.merchant].capability_status_updated',null,{related_object:{id:[...f.accounts.keys()][0]}},secret,'accounts'),{status:400});
 await f.event('v2.core.account[configuration.merchant].capability_status_updated',null,{related_object:{id:[...f.accounts.keys()][0]}},accountSecret,'accounts');
 assert.equal((await f.service.status(owner)).active,false);
});
test('HTTP endpoints require a session, owner role and browser origin; webhook uses its own raw signature',async t=>{
 const f=fixture(t),server=createProduct({dataDir:f.dir,connectOptions:f.options});server.listen(0,'127.0.0.1');await once(server,'listening');
 f.cleanup(()=>new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();}));const base='http://127.0.0.1:'+server.address().port;
 const anon=await fetch(base+'/api/connect/invoices');assert.equal(anon.status,401);
 const register=await fetch(base+'/api/account/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'http-owner@example.test',password:'long-test-password-123',name:'Owner',company:'Test'})});assert.equal(register.status,201);const cookie=register.headers.get('set-cookie').split(';')[0];
 const post=(path,body={},headers={})=>fetch(base+path,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 assert.equal((await post('/api/connect/onboarding',{}, {Origin:'https://attacker.test'})).status,403);
 assert.equal((await post('/api/connect/onboarding')).status,200);
 assert.equal((await fetch(base+'/api/connect/status',{headers:{Cookie:cookie}})).status,200);
 assert.equal((await post('/api/connect/invoices',{...f.body(),company_id:owner.company_id})).status,404);
 const raw=JSON.stringify({id:'evt_platform_invoice',type:'invoice.paid',livemode:false,data:{object:{id:'in_subscription'}}});const sig=f.client.webhooks.generateTestHeaderString({payload:raw,secret});
 const request=signature=>new Promise((resolve,reject)=>{const req=httpRequest(base+'/api/connect/webhook',{method:'POST',headers:{'stripe-signature':signature}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end(raw);});
 assert.equal(await request(sig),200);assert.equal(await request('invalid'),400);
 assert.equal((await fetch(base+'/invoicing.html')).status,200);
 assert.equal((await fetch(base+'/invoicing.js')).status,200);
});


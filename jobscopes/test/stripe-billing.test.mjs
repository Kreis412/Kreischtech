import {test} from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {request as httpRequest} from 'node:http';
import {stripeBilling,TEST_PRICES} from '../stripe-billing.mjs';
import {createProduct} from '../server.mjs';
const key='sk_test_fake_for_unit_tests',secret='whsec_fake_for_unit_tests';
const owner={company_id:'companyA',role:'Owner'},other={company_id:'companyB',role:'Owner'};
function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'cs-stripe-')),sdk=new Stripe(key),sessions=new Map(),subs=new Map(),invoices=new Map();let creates=0,wrongPrice=false;
 const client={webhooks:sdk.webhooks,prices:{retrieve:async price=>{const plan=Object.keys(TEST_PRICES).find(k=>TEST_PRICES[k]===price);return {id:price,livemode:false,active:true,currency:'usd',billing_scheme:'per_unit',unit_amount:wrongPrice?1:{solo:1900,crew:3900,pack:1000}[plan],type:plan==='pack'?'one_time':'recurring',recurring:plan==='pack'?null:{interval:'month',interval_count:1}};}},
  checkout:{sessions:{create:async params=>{creates++;const sid='cs_test_'+creates;const value={id:sid,livemode:false,status:'open',url:'https://checkout.stripe.com/c/pay/'+sid,created:Math.floor(Date.now()/1000),...params,line_items:{data:[{price:{id:params.line_items[0].price},quantity:1}],has_more:false}};sessions.set(sid,value);return value;},retrieve:async sid=>structuredClone(sessions.get(sid))}},
  subscriptions:{retrieve:async sid=>structuredClone(subs.get(sid)),update:async(sid,params)=>Object.assign(subs.get(sid),params)},invoices:{retrieve:async iid=>structuredClone(invoices.get(iid))}};
 const options={dataDir:dir,origin:'https://example.test',secretKey:key,webhookSecret:secret,enabled:true,client};let billing=stripeBilling(options);
 t.after(()=>{billing.close();rmSync(dir,{recursive:true,force:true});});
 function pay(sid,plan){const s=sessions.get(sid);Object.assign(s,{status:'complete',payment_status:'paid',currency:'usd',amount_total:{solo:1900,crew:3900,pack:1000}[plan]});if(plan!=='pack'){
  s.subscription='sub_'+sid;s.invoice='in_'+sid;const end=Math.floor(Date.now()/1000)+30*86400;
  subs.set(s.subscription,{id:s.subscription,livemode:false,metadata:s.metadata,status:'active',items:{data:[{price:{id:TEST_PRICES[plan]},quantity:1,current_period_end:end}]},cancel_at_period_end:false});
  invoices.set(s.invoice,{id:s.invoice,livemode:false,status:'paid',currency:'usd',amount_paid:s.amount_total,billing_reason:'subscription_create',parent:{subscription_details:{subscription:s.subscription}},lines:{has_more:false,data:[{pricing:{price_details:{price:TEST_PRICES[plan]}},quantity:1,period:{end}}]}});
 }return s;}
 async function event(type,object,eventId='evt_'+Math.random().toString().slice(2),overrides={}){const raw=JSON.stringify({id:eventId,type,livemode:false,data:{object},...overrides});const signature=sdk.webhooks.generateTestHeaderString({payload:raw,secret});return billing.webhook(Buffer.from(raw),signature);}
 return {dir,options,client,sessions,subs,invoices,pay,event,sdk,get billing(){return billing;},get creates(){return creates;},wrongPrice(){wrongPrice=true;},restart(){billing.close();billing=stripeBilling(options);}};
}
test('test checkout enforces owner, server prices, deduplication and company binding',async t=>{
 const f=fixture(t);
 await assert.rejects(f.billing.checkout({...owner,role:'Manager'},'solo'),{status:403});
 await assert.rejects(f.billing.checkout(owner,'invented'),{status:400});
 const first=await f.billing.checkout(owner,'solo');assert.match(first.url,/checkout.stripe.com/);
 await f.billing.checkout(owner,'solo');assert.equal(f.creates,1);
 await assert.rejects(f.billing.checkout(owner,'crew'),{status:409});
 await assert.rejects(f.billing.confirm(other,'cs_test_1'),{status:404});
 assert.equal((await f.billing.confirm(owner,'cs_test_1')).confirmed,false);
 assert.equal(f.billing.status(owner).test_balance,0);
 f.pay('cs_test_1','solo');await f.billing.confirm(owner,'cs_test_1');
 assert.equal(f.billing.status(owner).test_balance,20);assert.equal(f.billing.status(other).test_balance,0);
 await f.billing.confirm(owner,'cs_test_1');assert.equal(f.billing.status(owner).test_balance,20);
 await assert.rejects(f.billing.checkout(owner,'crew'),{status:409});
 f.restart();assert.equal(f.billing.status(owner).test_balance,20);
});
test('definitive Stripe validation failure permits a fresh attempt but uncertain failures preserve identity',async t=>{
 const f=fixture(t),create=f.client.checkout.sessions.create,keys=[];
 f.client.checkout.sessions.create=async(params,options)=>{keys.push(options.idempotencyKey);throw {type:'StripeInvalidRequestError',statusCode:400};};
 await assert.rejects(f.billing.checkout(owner,'solo'),/Please try checkout again/);
 f.client.checkout.sessions.create=async(params,options)=>{keys.push(options.idempotencyKey);throw {type:'StripeConnectionError'};};
 await assert.rejects(f.billing.checkout(owner,'solo'),/No automatic retry/);
 f.client.checkout.sessions.create=async(params,options)=>{keys.push(options.idempotencyKey);return create(params);};
 await f.billing.checkout(owner,'solo');
 assert.notEqual(keys[0],keys[1]);assert.equal(keys[1],keys[2]);assert.equal(f.creates,1);
});

test('pack test fulfillment is idempotent and malformed or unpaid prices never grant credits',async t=>{
 const f=fixture(t);await f.billing.checkout(owner,'pack');const s=f.pay('cs_test_1','pack');
 s.amount_total=1;await assert.rejects(f.billing.confirm(owner,s.id),{status:409});assert.equal(f.billing.status(owner).test_balance,0);
 s.amount_total=1000;s.livemode=true;await assert.rejects(f.billing.confirm(owner,s.id),{status:409});
 s.livemode=false;await f.event('checkout.session.completed',s,'evt_pack');await f.event('checkout.session.completed',s,'evt_pack');
 await f.billing.sync(owner);assert.equal(f.billing.status(owner).test_balance,10);
 f.wrongPrice();await assert.rejects(f.billing.checkout(other,'crew'),{status:503});
});
test('verified paid renewals add once, failures add nothing and cancellation retains pilot data',async t=>{
 const f=fixture(t);await f.billing.checkout(owner,'crew');const s=f.pay('cs_test_1','crew');
 // Invoice may arrive before checkout completion.
 await f.event('invoice.paid',{id:s.invoice});await f.billing.confirm(owner,s.id);assert.equal(f.billing.status(owner).test_balance,60);
 const renewal=structuredClone(f.invoices.get(s.invoice));renewal.id='in_renewal';renewal.billing_reason='subscription_cycle';renewal.lines.data[0].period.end+=30*86400;
 f.invoices.set(renewal.id,renewal);f.subs.get(s.subscription).items.data[0].current_period_end=renewal.lines.data[0].period.end;
 await Promise.all([f.event('invoice.paid',{id:renewal.id},'evt_renewal'),f.event('invoice.paid',{id:renewal.id},'evt_renewal')]);
 assert.equal(f.billing.status(owner).test_balance,120);
 await f.event('invoice.paid',{id:renewal.id},'evt_other_delivery');assert.equal(f.billing.status(owner).test_balance,120);
 renewal.id='in_failed';renewal.status='open';f.invoices.set(renewal.id,renewal);f.subs.get(s.subscription).status='past_due';
 await f.event('invoice.payment_failed',{id:renewal.id});await f.event('invoice.paid',{id:renewal.id});assert.equal(f.billing.status(owner).test_balance,120);
 assert.equal(f.billing.status(owner).subscriptions[0].status,'past_due');
 f.subs.get(s.subscription).status='active';await f.billing.cancel(owner);assert.equal(f.billing.status(owner).subscriptions[0].cancel_at_end,1);
 f.subs.get(s.subscription).status='canceled';await f.event('customer.subscription.deleted',f.subs.get(s.subscription));
 assert.equal(f.billing.status(owner).subscriptions[0].status,'canceled');
});
test('webhooks reject tampering, stale signatures, live events and unconfigured live keys',async t=>{
 const f=fixture(t),raw=JSON.stringify({id:'evt_one',livemode:false,type:'ignored',data:{object:{}}});
 const signature=f.sdk.webhooks.generateTestHeaderString({payload:raw,secret});
 await assert.rejects(f.billing.webhook(Buffer.from(raw+' '),signature),{status:400});
 await assert.rejects(f.billing.webhook(Buffer.from(raw),f.sdk.webhooks.generateTestHeaderString({payload:raw,secret,timestamp:1})),{status:400});
 await assert.rejects(f.event('ignored',{},'evt_live',{livemode:true}),{status:400});
 const disabled=stripeBilling({...f.options,secretKey:'sk_live_not_allowed'});assert.equal(disabled.ready,false);disabled.close();
 assert.equal(stripeBilling({...f.options,webhookSecret:''}).ready,false);
});
test('gateway accepts signed machine callback without browser origin but keeps browser mutations protected',async t=>{
 let cleanup;const f=fixture({after:fn=>cleanup=fn});const app=createProduct({dataDir:f.dir,publicOrigin:'https://example.test',billingOptions:f.options});
 app.listen(0,'127.0.0.1');await once(app,'listening');
 t.after(async()=>{await new Promise(r=>{app.close(r);app.closeIdleConnections();});cleanup();});
 const raw=JSON.stringify({id:'evt_gateway',livemode:false,type:'ignored',data:{object:{}}});
 const send=(path,signature,extra={})=>new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port:app.address().port,path,method:'POST',headers:{host:'example.test','x-forwarded-proto':'https','stripe-signature':signature,'content-type':'application/json',...extra}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end(raw);});
 const signature=f.sdk.webhooks.generateTestHeaderString({payload:raw,secret});
 assert.equal(await send('/api/billing/webhook',signature),200);
 assert.equal(await send('/api/billing/webhook','bad'),400);
 assert.equal(await send('/api/billing/webhook',signature,{host:'other.test'}),403);
 assert.equal(await send('/api/billing/checkout',signature),403);
});

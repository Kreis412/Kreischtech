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
function fixture(t,live=false){
 const prices=live?{solo:'price_live_solo'}:TEST_PRICES;
 const dir=mkdtempSync(join(tmpdir(),'cs-stripe-')),sdk=new Stripe(key),sessions=new Map(),subs=new Map(),invoices=new Map();let creates=0,wrongPrice=false;
 const client={webhooks:sdk.webhooks,prices:{retrieve:async price=>{const plan=Object.keys(prices).find(k=>prices[k]===price);return {id:price,livemode:live,active:true,currency:'usd',billing_scheme:'per_unit',unit_amount:wrongPrice?1:{solo:1900,crew:3900,pack:1000}[plan],type:plan==='pack'?'one_time':'recurring',recurring:plan==='pack'?null:{interval:'month',interval_count:1}};}},
  checkout:{sessions:{create:async params=>{creates++;const sid=(live?'cs_live_':'cs_test_')+creates;const value={id:sid,livemode:live,status:'open',url:'https://checkout.stripe.com/c/pay/'+sid,created:Math.floor(Date.now()/1000),...params,line_items:{data:[{price:{id:params.line_items[0].price},quantity:1}],has_more:false}};sessions.set(sid,value);return value;},retrieve:async sid=>structuredClone(sessions.get(sid))}},
  subscriptions:{retrieve:async sid=>structuredClone(subs.get(sid)),update:async(sid,params)=>Object.assign(subs.get(sid),params)},invoices:{retrieve:async iid=>structuredClone(invoices.get(iid))}};
 const charges=new Map(),intents=new Map(),disputes=new Map();
 client.charges={retrieve:async cid=>structuredClone(charges.get(cid))};
 client.paymentIntents={retrieve:async pid=>structuredClone(intents.get(pid))};
 client.disputes={list:async({charge})=>({has_more:false,data:structuredClone(disputes.get(charge)||[])})};
 client.invoicePayments={list:async({invoice})=>{const inv=invoices.get(invoice),pid=inv.payment_intent;return {has_more:false,data:[{invoice,livemode:live,status:'paid',currency:'usd',amount_paid:inv.amount_paid,payment:{type:'payment_intent',payment_intent:pid}}]};}};
 const options={dataDir:dir,origin:'https://example.test',secretKey:live?'sk_live_fake_for_unit_tests':key,mode:live?'live':'test',prices,webhookSecret:secret,enabled:true,client};let billing=stripeBilling(options);
 t.after(()=>{billing.close();rmSync(dir,{recursive:true,force:true});});
 function pay(sid,plan){const s=sessions.get(sid);Object.assign(s,{status:'complete',payment_status:'paid',currency:'usd',amount_total:{solo:1900,crew:3900,pack:1000}[plan]});if(plan!=='pack'){
  s.subscription='sub_'+sid;s.invoice='in_'+sid;const end=Math.floor(Date.now()/1000)+30*86400;
  subs.set(s.subscription,{id:s.subscription,livemode:live,metadata:s.metadata,status:'active',items:{data:[{price:{id:prices[plan]},quantity:1,current_period_end:end}]},cancel_at_period_end:false});
  invoices.set(s.invoice,{id:s.invoice,livemode:live,status:'paid',currency:'usd',amount_paid:s.amount_total,billing_reason:'subscription_create',parent:{subscription_details:{subscription:s.subscription}},lines:{has_more:false,data:[{pricing:{price_details:{price:prices[plan]}},quantity:1,period:{end}}]}});
 }
 s.payment_intent='pi_'+sid;
 intents.set(s.payment_intent,{id:s.payment_intent,livemode:live,status:'succeeded',currency:'usd',amount_received:s.amount_total,latest_charge:'ch_'+sid});
 charges.set('ch_'+sid,{id:'ch_'+sid,payment_intent:s.payment_intent,livemode:live,status:'succeeded',paid:true,currency:'usd',amount:s.amount_total,amount_refunded:0,disputed:false});
 if(s.invoice)invoices.get(s.invoice).payment_intent=s.payment_intent;
 return s;}
 async function event(type,object,eventId='evt_'+Math.random().toString().slice(2),overrides={}){const raw=JSON.stringify({id:eventId,type,livemode:live,data:{object},...overrides});const signature=sdk.webhooks.generateTestHeaderString({payload:raw,secret});return billing.webhook(Buffer.from(raw),signature);}
 return {dir,options,client,sessions,subs,invoices,charges,intents,disputes,pay,event,sdk,get billing(){return billing;},get creates(){return creates;},wrongPrice(){wrongPrice=true;},restart(){billing.close();billing=stripeBilling(options);}};
}
test('live Solo grants separate saved-result allowances, refunds both and rejects unsupported plans',async t=>{
 const f=fixture(t,true);
 await assert.rejects(f.billing.checkout(owner,'crew'),{status:409});
 await f.billing.checkout(owner,'solo');const s=f.pay('cs_live_1','solo');await f.billing.confirm(owner,s.id);
 assert.equal(f.billing.status(owner).mode,'stripe-live');
 assert.equal(f.billing.balance('companyA'),25);assert.equal(f.billing.balance('companyA','joe'),25);
 const run=f.billing.runSaved('companyA');await run('analysis','photo',async()=>({saved:true}));await run('joe','question',async()=>'Saved answer');
 await assert.rejects(run('analysis','failed',async()=>{throw new Error('invalid output');}));
 assert.equal(f.billing.balance('companyA'),24);assert.equal(f.billing.balance('companyA','joe'),24);
 await assert.rejects(f.billing.runSaved('companyB')('analysis','foreign',async()=>{}),{status:429});
 await f.event('invoice.paid',{id:s.invoice});assert.equal(f.billing.balance('companyA','joe'),24);
 f.charges.get('ch_'+s.id).amount_refunded=1900;await f.event('charge.refunded',{id:'ch_'+s.id});
 assert.equal(f.billing.balance('companyA'),0);assert.equal(f.billing.balance('companyA','joe'),0);
 f.restart();assert.equal(f.billing.hasPaidCompany('companyA'),true);assert.equal(f.billing.balance('companyA'),0);
 await assert.rejects(f.event('ignored',{},'evt_test_in_live',{livemode:false}),{status:400});
});

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
 assert.equal(f.billing.status(owner).test_balance,25);assert.equal(f.billing.status(other).test_balance,0);
 await f.billing.confirm(owner,'cs_test_1');assert.equal(f.billing.status(owner).test_balance,25);
 await assert.rejects(f.billing.checkout(owner,'crew'),{status:409});
 f.restart();assert.equal(f.billing.status(owner).test_balance,25);
});

test('hosted paid account uses Joe credits, keeps saved replies free and blocks extra seats',async t=>{
 let cleanup,calls=0;const f=fixture({after:fn=>cleanup=fn},true),oldKey=process.env.OPENAI_API_KEY;
 process.env.OPENAI_API_KEY='test-only-key';
 const app=createProduct({dataDir:f.dir,publicOrigin:'https://example.test',registrationCode:'invite-for-test',billingOptions:f.options,cloudRequest:async()=>{calls++;return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:'Draft response for human review'}]}]})};}});
 app.listen(0,'127.0.0.1');await once(app,'listening');
 t.after(async()=>{await new Promise(r=>{app.close(r);app.closeIdleConnections();});cleanup();if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;});
 const user=()=>({cookie:'',async send(path,body){return new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port:app.address().port,path,method:body?'POST':'GET',headers:{host:'example.test','x-forwarded-proto':'https',origin:'https://example.test',cookie:this.cookie,'content-type':'application/json'}},res=>{if(res.headers['set-cookie'])this.cookie=res.headers['set-cookie'][0].split(';')[0];let data='';res.on('data',b=>data+=b);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(data)}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});}});
 const a=user(),b=user();
 for(const [u,email] of [[a,'a@example.test'],[b,'b@example.test']])assert.equal((await u.send('/api/account/register',{email,password:'long test password 2026',name:'Owner',company:email,registration_code:'invite-for-test'})).status,201);
 const invite=await a.send('/api/account/invites',{email:'b@example.test',role:'Manager'});assert.equal(invite.status,201);
 assert.equal((await a.send('/api/billing/checkout',{plan:'solo'})).status,200);f.pay('cs_live_1','solo');
 assert.equal((await a.send('/api/billing/confirm',{session_id:'cs_live_1'})).status,200);
 assert.equal((await b.send('/api/account/join',{code:invite.body.code})).status,409);
 assert.equal((await a.send('/api/account/invites',{email:'c@example.test',role:'Viewer'})).status,409);
 const question={question:'Help me plan',request_id:'paid-joe-request-one',include_context:false};
 const answer=await a.send('/api/joe',question);assert.equal(answer.status,201,JSON.stringify(answer.body));
 assert.equal((await a.send('/api/joe',question)).body.reused,true);assert.equal(calls,1);
 const balances=(await a.send('/api/billing')).body;assert.equal(balances.balance,25);assert.equal(balances.joe_balance,24);
 assert.equal((await b.send('/api/billing')).body.joe_balance,0);
 assert.equal((await a.send('/api/billing/cancel',{})).status,200);
 assert.equal((await a.send('/api/billing')).body.subscriptions[0].cancel_at_end,1);
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
 renewal.payment_intent='pi_renewal';f.intents.set('pi_renewal',{...f.intents.get(s.payment_intent),id:'pi_renewal',latest_charge:'ch_renewal'});f.charges.set('ch_renewal',{...f.charges.get('ch_'+s.id),id:'ch_renewal',payment_intent:'pi_renewal'});
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

test('refund and dispute deliveries reconcile current payment state without granting twice',async t=>{
 const f=fixture(t);await f.billing.checkout(owner,'solo');const s=f.pay('cs_test_1','solo'),charge=f.charges.get('ch_'+s.id);
 // Refund event precedes the first invoice delivery: fulfillment must still see it.
 charge.amount_refunded=950;await f.event('charge.refunded',{id:charge.id});
 await f.billing.confirm(owner,s.id);assert.equal(f.billing.status(owner).test_balance,12);
 charge.disputed=true;f.disputes.set(charge.id,[{charge:charge.id,livemode:false,status:'needs_response'}]);
 await f.event('charge.dispute.created',{charge:charge.id});assert.equal(f.billing.status(owner).test_balance,0);
 f.disputes.get(charge.id)[0].status='won';await f.event('charge.dispute.closed',{charge:charge.id});assert.equal(f.billing.status(owner).test_balance,12);
 await f.event('charge.dispute.created',{charge:charge.id});assert.equal(f.billing.status(owner).test_balance,12);
 charge.amount_refunded=1900;await f.event('charge.refunded',{id:charge.id});
 f.restart();assert.equal(f.billing.status(owner).test_balance,0);
 await f.event('invoice.paid',{id:s.invoice});assert.equal(f.billing.status(owner).test_balance,0);
 assert.equal(f.billing.status(other).test_balance,0);
});

test('one charge cannot buy two invoice grants and refund events cover packs',async t=>{
 const f=fixture(t);await f.billing.checkout(owner,'solo');const s=f.pay('cs_test_1','solo');await f.billing.confirm(owner,s.id);
 const duplicate={...f.invoices.get(s.invoice),id:'in_reused_payment'};f.invoices.set(duplicate.id,duplicate);
 await assert.rejects(f.event('invoice.paid',{id:duplicate.id}),{status:409});assert.equal(f.billing.status(owner).test_balance,25);
 await f.billing.checkout(other,'pack');const pack=f.pay('cs_test_2','pack');await f.billing.confirm(other,pack.id);assert.equal(f.billing.status(other).test_balance,10);
 const charge=f.charges.get('ch_'+pack.id);charge.amount_refunded=1000;await f.event('charge.refunded',{id:charge.id});assert.equal(f.billing.status(other).test_balance,0);
 assert.equal(f.billing.status(owner).test_balance,25);
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


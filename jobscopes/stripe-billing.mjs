import Stripe from 'stripe';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {billingStore, billingPreview, PLANS} from './billing.mjs';
import {invoiceCharge,intentCharge,chargeAllowance} from './payment-entitlement.mjs';
import {paidUsage} from './paid-usage.mjs';

// These public IDs were verified in this account's TEST catalog. Never reuse for live billing.
export const TEST_PRICES=Object.freeze({solo:'price_1ULhyiLNHFjZswsLREk1wyW7',crew:'price_1ULhzgLNHFjZswsLem7PSQsP',pack:'price_1ULi17LNHFjZswsLkIg3xK4L'});
export const STRIPE_EVENTS=['checkout.session.completed','checkout.session.async_payment_succeeded','invoice.paid','invoice.payment_failed','customer.subscription.updated','customer.subscription.deleted','charge.refunded','charge.dispute.created','charge.dispute.updated','charge.dispute.closed'];
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const id=value=>typeof value==='string'?value:value?.id;
const planFor=key=>PLANS.find(p=>p.id===key)||fail(400,'Choose a valid plan.');
const validId=(value,prefix)=>typeof value==='string'&&new RegExp('^'+prefix+'[A-Za-z0-9_]+$').test(value)&&value.length<=250;
const safeUrl=(value,hostname)=>{try{const u=new URL(value);if(u.protocol==='https:'&&u.hostname===hostname&&!u.username&&!u.password)return u.href;}catch{}fail(502,'Stripe returned an unexpected checkout address.');};

export function stripeBilling({dataDir,origin,secretKey='',webhookSecret='',enabled=false,mode='test',prices=TEST_PRICES,memberCount=()=>1,client,now=()=>Date.now()}={}){
 // Fail closed without disrupting existing pilot access if an operator supplies a live key.
 const live=mode==='live';
 const ready=enabled && ['test','live'].includes(mode) && (live?/^sk_live_\S+$/:/^sk_test_\S+$/).test(secretKey) && /^whsec_\S+$/.test(webhookSecret) && /^https:\/\//.test(origin||'') && (!live||(validId(prices.solo,'price_')&&prices.solo!==TEST_PRICES.solo));
 if(!ready)return {ready:false,live:false,hasPaidCompany:()=>false,status:()=>billingPreview(),close(){}};
 const stripe=client||new Stripe(secretKey,{apiVersion:'2026-08-26.dahlia',maxNetworkRetries:0,timeout:20000});
 const directory=join(dataDir,live?'stripe-live':'stripe-test');mkdirSync(directory,{recursive:true});
 const credits=billingStore(directory,{now}),db=new DatabaseSync(join(directory,'checkout.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,company TEXT NOT NULL,plan TEXT NOT NULL,created INTEGER NOT NULL,session TEXT UNIQUE,url TEXT,subscription TEXT UNIQUE,fulfilled INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS subscriptions(id TEXT PRIMARY KEY,company TEXT NOT NULL,plan TEXT NOT NULL,status TEXT NOT NULL,period_end INTEGER NOT NULL,cancel_at_end INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS invoices(id TEXT PRIMARY KEY,company TEXT NOT NULL,subscription TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS checkout_locks(company TEXT PRIMARY KEY,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS payment_receipts(grant_id TEXT PRIMARY KEY,company TEXT NOT NULL,charge TEXT NOT NULL UNIQUE,amount INTEGER NOT NULL,credits INTEGER NOT NULL);`);
 const inFlight=new Map();
 let pending=Promise.resolve();
 const serial=fn=>{const job=pending.then(fn);pending=job.catch(()=>{});return job;};
 function receipt(grantId,company,charge,amount,allowance){
  const old=db.prepare('SELECT * FROM payment_receipts WHERE grant_id=? OR charge=?').all(grantId,charge);
  if(old.some(r=>r.grant_id!==grantId||r.company!==company||r.charge!==charge||r.amount!==amount||r.credits!==allowance))fail(409,'Payment is already linked to a different credit grant.');
  db.prepare('INSERT OR IGNORE INTO payment_receipts VALUES(?,?,?,?,?)').run(grantId,company,charge,amount,allowance);
 }
 const owner=s=>{if(s.role!=='Owner')fail(403,'Only the company owner can manage billing.');};
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 async function external(fn){try{return await fn();}catch(e){if(e.status)throw e;fail(502,'Stripe could not complete this step. No automatic retry was made.');}}
 function status(session){
  const subscriptions=db.prepare('SELECT plan,status,period_end,cancel_at_end FROM subscriptions WHERE company=? ORDER BY period_end DESC').all(session.company_id);
  if(live)return {mode:'stripe-live',currency:'USD',checkout_enabled:session.role==='Owner',plans:[{...planFor('solo'),joe_answers:25}],balance:credits.balance(session.company_id),joe_balance:credits.balance(session.company_id,'joe'),subscriptions,support_email:'kreischtech@gmail.com'};
  return {...billingPreview(),mode:'stripe-test',checkout_enabled:session.role==='Owner',message:'Test checkout only. No real money is collected, and test credits do not increase your paid AI allowance.',test_balance:credits.balance(session.company_id),subscriptions};
 }
 async function checkout(session,key){
  owner(session);const plan=planFor(key),company=session.company_id;
  if(live&&(key!=='solo'||memberCount(company)!==1))fail(409,'Solo is for one user. Contact support about a company with multiple members.');
  transaction(()=>{
   db.prepare('DELETE FROM checkout_locks WHERE expires<=?').run(now());
   if(db.prepare('SELECT 1 FROM checkout_locks WHERE company=?').get(company))fail(409,'Checkout is already being prepared. Please wait.');
   if(db.prepare('SELECT count(*) n FROM orders WHERE company=? AND created>?').get(company,now()-3600000).n>=10)fail(429,'Too many checkouts. Please try again in an hour.');
   if(key!=='pack'&&db.prepare("SELECT 1 FROM subscriptions WHERE company=? AND status NOT IN ('canceled','incomplete_expired')").get(company))fail(409,'This company already has a subscription. Contact support before starting another.');
   db.prepare('INSERT INTO checkout_locks VALUES(?,?)').run(company,now()+120000);
  });
  try{
   // Reuse a still-open order after a double-click or a lost network response.
   let open=db.prepare('SELECT * FROM orders WHERE company=? AND fulfilled=0 ORDER BY created DESC LIMIT 1').get(company);
   if(open){
    if(open.session){const existing=await external(()=>stripe.checkout.sessions.retrieve(open.session));
     if(existing.status==='complete')fail(409,'A payment is awaiting confirmation. Use the payment status button.');
     if(existing.status==='open'){
      if(open.plan!==key)fail(409,'A different checkout is still pending. Finish it or let it expire before starting another.');
      return {url:safeUrl(existing.url,'checkout.stripe.com')};
     }
     if(existing.status!=='expired')fail(409,'The previous checkout needs review.');
     db.prepare('UPDATE orders SET fulfilled=-1 WHERE id=?').run(open.id);open=null;
    }
    if(open&&!open.session&&(open.plan!==key||now()-open.created>1800000))fail(409,'A previous checkout request needs review before another can be created.');
   }
   const price=await external(()=>stripe.prices.retrieve(prices[key]));
   if(price.livemode!==live||!price.active||price.currency!=='usd'||price.unit_amount!==plan.price_cents||price.billing_scheme!=='per_unit'||(key==='pack'?price.type!=='one_time':price.type!=='recurring'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1))fail(503,'The Stripe price does not match this plan. Ask the owner to check the catalog.');
   const order=open&&!open.session?open:{id:randomUUID(),company,plan:key,created:now()};
   if(live&&memberCount(company)!==1)fail(409,'Solo includes one user. Company membership changed while checkout was being prepared.');
   if(order!==open)db.prepare('INSERT INTO orders(id,company,plan,created) VALUES(?,?,?,?)').run(order.id,company,key,order.created);
   const metadata={contractorsight_order:order.id};
   const result=await external(async()=>{
    try{return await stripe.checkout.sessions.create({mode:key==='pack'?'payment':'subscription',client_reference_id:order.id,metadata,line_items:[{price:prices[key],quantity:1}],payment_method_types:['card'],expires_at:Math.floor(order.created/1000)+1860,
     ...(key==='pack'?{}:{subscription_data:{metadata}}),success_url:origin+'/?stripe_session={CHECKOUT_SESSION_ID}#settings/billing',cancel_url:origin+'/#settings/billing'}, {idempotencyKey:'cs-'+mode+':'+order.id});}
    catch(e){
     // Only retire a definitive validation rejection. Network/server/idempotency
     // errors may have created a session and must retain the original identity.
     if(e.type==='StripeInvalidRequestError'&&e.statusCode===400){
      db.prepare('UPDATE orders SET fulfilled=-1 WHERE id=? AND session IS NULL').run(order.id);
      fail(502,'Stripe rejected this checkout attempt. No payment was created. Please try checkout again.');
     }
     throw e;
    }
   });
   if(result.livemode!==live||!validId(result.id,live?'cs_live_':'cs_test_'))fail(502,'Stripe did not return the expected checkout.');
   const url=safeUrl(result.url,'checkout.stripe.com');db.prepare('UPDATE orders SET session=?,url=? WHERE id=?').run(result.id,url,order.id);
   return {url};
  }finally{db.prepare('DELETE FROM checkout_locks WHERE company=?').run(company);}
 }
 async function refreshSubscription(subscriptionId,order){
  const sub=await external(()=>stripe.subscriptions.retrieve(subscriptionId));
  if(sub.livemode!==live||sub.metadata?.contractorsight_order!==order.id)fail(409,'Subscription does not match the saved order.');
  const items=sub.items?.data||[],item=items[0];
  if(items.length!==1||id(item.price)!==prices[order.plan]||item.quantity!==1)fail(409,'Subscription pricing differs from the saved order.');
  const end=item.current_period_end*1000;
  if(!Number.isSafeInteger(end))fail(502,'Stripe returned an invalid subscription period.');
  db.prepare('UPDATE orders SET subscription=? WHERE id=?').run(sub.id,order.id);
  db.prepare('INSERT INTO subscriptions VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,period_end=excluded.period_end,cancel_at_end=excluded.cancel_at_end').run(sub.id,order.company,order.plan,sub.status,end,sub.cancel_at_period_end?1:0);
  return sub;
 }
 async function invoicePaid(invoiceId){
  const invoice=await external(()=>stripe.invoices.retrieve(invoiceId));
  if(invoice.livemode!==live||invoice.status!=='paid')return;
  const subscriptionId=id(invoice.parent?.subscription_details?.subscription);if(!validId(subscriptionId,'sub_'))return;
  const sub=await external(()=>stripe.subscriptions.retrieve(subscriptionId));
  const order=db.prepare('SELECT * FROM orders WHERE id=?').get(sub.metadata?.contractorsight_order||'');if(!order)return;
  if(order.plan==='pack'||sub.livemode!==live)fail(409,'Invoice does not match a subscription.');
  await refreshSubscription(subscriptionId,order);
  const lines=invoice.lines?.data||[],line=lines[0],plan=planFor(order.plan);
  if(invoice.lines?.has_more||lines.length!==1||id(line.pricing?.price_details?.price)!==prices[order.plan]||line.quantity!==1||invoice.currency!=='usd'||invoice.amount_paid!==plan.price_cents||!['subscription_create','subscription_cycle'].includes(invoice.billing_reason))fail(409,'This invoice needs manual review before granting credits.');
  const expires=line.period?.end*1000;
  if(!Number.isSafeInteger(expires))fail(502,'Invoice period is invalid.');
  if(expires<=now())return;
  const charge=await external(()=>invoiceCharge(stripe,invoice,plan.price_cents,live));
  const grantId='invoice:'+invoice.id;
  const allowance=credits.grantInfo(grantId,order.company)?.amount??plan.analyses;
  const adjustment=await external(()=>chargeAllowance(stripe,charge,plan.price_cents,allowance,live));
  // Save the mapping before granting; redelivery recovers a crash between DBs.
  receipt(grantId,order.company,charge.id,plan.price_cents,allowance);
  // Invoice identity deduplicates return-page checks and webhook deliveries, including restarts.
  if(expires>now()&&!db.prepare('SELECT 1 FROM invoices WHERE id=?').get(invoice.id)){
   credits.grant({id:grantId,company:order.company,amount:allowance,expires,...adjustment});
   db.prepare('INSERT OR IGNORE INTO invoices VALUES(?,?,?)').run(invoice.id,order.company,subscriptionId);
  }
  credits.adjust(grantId,order.company,adjustment.available,adjustment.reason);
  if(live){
   credits.grant({id:grantId+':joe',company:order.company,kind:'joe',amount:25,expires,...adjustment});
   credits.adjust(grantId+':joe',order.company,adjustment.available,adjustment.reason);
  }
 }
 async function fulfill(sessionId,company){
  if(!validId(sessionId,live?'cs_live_':'cs_test_'))fail(400,'Invalid checkout reference.');
  const stored=db.prepare('SELECT * FROM orders WHERE session=?').get(sessionId);
  if(!stored||(company&&stored.company!==company))fail(404,'Test checkout not found for this company.');
  const result=await external(()=>stripe.checkout.sessions.retrieve(sessionId,{expand:['line_items']}));
  if(result.livemode!==live||result.client_reference_id!==stored.id||result.metadata?.contractorsight_order!==stored.id)fail(409,'Checkout does not match the saved order.');
  if(result.status!=='complete'||result.payment_status!=='paid')return {confirmed:false};
  const plan=planFor(stored.plan),lines=result.line_items?.data||[];
  if(result.line_items?.has_more||lines.length!==1||id(lines[0].price)!==prices[stored.plan]||lines[0].quantity!==1||result.amount_total!==plan.price_cents||result.currency!=='usd'||result.mode!==(stored.plan==='pack'?'payment':'subscription'))fail(409,'Payment details differ from the saved order.');
  if(stored.plan==='pack'){
   // Sandbox pack lifetime only; commercial expiry terms remain undecided.
   const expires=(result.created+365*86400)*1000;
   if(expires>now()){
    const charge=await external(()=>intentCharge(stripe,id(result.payment_intent),plan.price_cents));
    const adjustment=await external(()=>chargeAllowance(stripe,charge,plan.price_cents,plan.analyses));
    const grantId='checkout:'+sessionId;
    receipt(grantId,stored.company,charge.id,plan.price_cents,plan.analyses);
    credits.grant({id:grantId,company:stored.company,amount:plan.analyses,expires,...adjustment});
    credits.adjust(grantId,stored.company,adjustment.available,adjustment.reason);
   }
  }else{
   if(!validId(id(result.subscription),'sub_')||!validId(id(result.invoice),'in_'))fail(502,'Subscription invoice is missing.');
   await refreshSubscription(id(result.subscription),stored);await invoicePaid(id(result.invoice));
  }
  db.prepare('UPDATE orders SET fulfilled=1 WHERE id=?').run(stored.id);return {confirmed:true};
 }
 async function confirm(session,sessionId){owner(session);return serial(()=>fulfill(sessionId,session.company_id));}
 async function sync(session){
  owner(session);return serial(async()=>{const orders=db.prepare('SELECT session FROM orders WHERE company=? AND session IS NOT NULL AND fulfilled=0 ORDER BY created DESC LIMIT 10').all(session.company_id);
  for(const order of orders)await fulfill(order.session,session.company_id);
  return status(session);});
 }
 async function cancel(session){
  owner(session);const sub=db.prepare("SELECT * FROM subscriptions WHERE company=? AND status NOT IN ('canceled','incomplete_expired') ORDER BY period_end DESC LIMIT 1").get(session.company_id);
  if(!sub)fail(404,'No subscription to cancel.');
  await external(()=>stripe.subscriptions.update(sub.id,{cancel_at_period_end:true},{idempotencyKey:'cs-'+mode+'-cancel:'+sub.id}));
  await refreshSubscription(sub.id,db.prepare('SELECT * FROM orders WHERE subscription=?').get(sub.id));return status(session);
 }
 async function webhook(raw,signature){
  let event;try{event=stripe.webhooks.constructEvent(raw,signature,webhookSecret,300);}catch{fail(400,'Invalid Stripe signature.');}
  if(event.livemode!==live)fail(400,'Payment event mode does not match this workspace.');
  if(db.prepare('SELECT 1 FROM events WHERE id=?').get(event.id))return;
  if(inFlight.has(event.id))return inFlight.get(event.id);
  const job=serial(async()=>{
   const object=event.data?.object;
   if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
    // Ignore unrelated Stripe test products on the same account.
    if(db.prepare('SELECT 1 FROM orders WHERE session=?').get(object.id))await fulfill(object.id);
   }else if(event.type==='invoice.paid')await invoicePaid(object.id);
   else if(['charge.refunded','charge.dispute.created','charge.dispute.updated','charge.dispute.closed'].includes(event.type)){
    const chargeId=event.type==='charge.refunded'?object.id:id(object.charge);
    const receipts=db.prepare('SELECT * FROM payment_receipts WHERE charge=?').all(chargeId||'');
    if(receipts.length){
     const charge=await external(()=>stripe.charges.retrieve(chargeId));
     for(const receipt of receipts){
      const adjustment=await external(()=>chargeAllowance(stripe,charge,receipt.amount,receipt.credits,live));
      // A receipt can exist without a grant after an interrupted fulfillment.
      try{credits.adjust(receipt.grant_id,receipt.company,adjustment.available,adjustment.reason);}catch(e){if(e.status!==404)throw e;}
      if(live){try{credits.adjust(receipt.grant_id+':joe',receipt.company,adjustment.available,adjustment.reason);}catch(e){if(e.status!==404)throw e;}}
     }
    }
   }
   else if(event.type==='invoice.payment_failed'){
    const invoice=await external(()=>stripe.invoices.retrieve(object.id)),subscriptionId=id(invoice.parent?.subscription_details?.subscription);
    const order=db.prepare('SELECT * FROM orders WHERE subscription=?').get(subscriptionId||'');if(order)await refreshSubscription(subscriptionId,order);
   }else if(['customer.subscription.updated','customer.subscription.deleted'].includes(event.type)){
    const order=db.prepare('SELECT * FROM orders WHERE id=?').get(object.metadata?.contractorsight_order||'');if(order)await refreshSubscription(object.id,order);
   }
   db.prepare('INSERT OR IGNORE INTO events VALUES(?,?)').run(event.id,now());
  });inFlight.set(event.id,job);try{await job;}finally{inFlight.delete(event.id);}
 }
 const hasPaidCompany=company=>live&&!!db.prepare('SELECT 1 FROM orders WHERE company=? LIMIT 1').get(company);
 const runSaved=company=>paidUsage(credits,company);
 const balance=(company,kind='analysis')=>credits.balance(company,kind);
 return {ready:true,live,status,checkout,confirm,sync,cancel,webhook,hasPaidCompany,runSaved,balance,close(){credits.close();db.close();}};
}

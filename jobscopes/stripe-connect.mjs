import Stripe from 'stripe';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

// Deliberately independent of stripe-billing.mjs and its subscription/credit ledger.
export const CONNECT_INVOICE_EVENTS=['invoice.created','invoice.updated','invoice.finalized','invoice.sent','invoice.paid','invoice.payment_failed','invoice.voided','invoice.marked_uncollectible','invoice.deleted'];
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const objectId=value=>typeof value==='string'?value:value?.id;
const text=(value,max)=>typeof value==='string'&&value.trim().length<=max?value.trim():fail(400,'Invalid invoice details.');
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const stripeUrl=(value,host)=>{try{const u=new URL(value);if(u.protocol==='https:'&&u.hostname===host&&!u.username&&!u.password)return u.href;}catch{}fail(502,'Stripe returned an unexpected address.');};

export function stripeConnect({dataDir,origin,enabled=false,mode='sandbox',allowLive=false,secretKey='',webhookSecret='',accountWebhookSecret='',client,now=Date.now,projectExists}={}){
 const live=mode==='live';
 const ready=enabled&&['sandbox','live'].includes(mode)&&(!live||allowLive)&&new RegExp(`^[sr]k_${live?'live':'test'}_\\S+$`).test(secretKey)&&/^whsec_\S+$/.test(webhookSecret)&&/^https:\/\//.test(origin||'');
 if(!ready)return {ready:false,status:async()=>({enabled:false,mode:'disabled',message:'Contractor invoicing is not configured yet.'}),close(){}};
 origin=new URL(origin).origin;
 const stripe=client||new Stripe(secretKey,{apiVersion:'2026-08-26.dahlia',maxNetworkRetries:0,timeout:20000});
 const directory=join(dataDir,live?'connect-live':'connect-sandbox');mkdirSync(directory,{recursive:true});
 const db=new DatabaseSync(join(directory,'invoicing.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS accounts(company TEXT PRIMARY KEY,request_id TEXT NOT NULL,created INTEGER NOT NULL,payload TEXT NOT NULL,account TEXT UNIQUE,active INTEGER NOT NULL DEFAULT 0,disconnected INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS invoices(id TEXT PRIMARY KEY,company TEXT NOT NULL,project TEXT NOT NULL,request_id TEXT NOT NULL,payload TEXT NOT NULL,created INTEGER NOT NULL,customer TEXT,invoice TEXT UNIQUE,complete INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'preparing',url TEXT,amount_due INTEGER NOT NULL DEFAULT 0,amount_paid INTEGER NOT NULL DEFAULT 0,currency TEXT NOT NULL DEFAULT 'usd',sent INTEGER NOT NULL DEFAULT 0,UNIQUE(company,request_id));
 CREATE TABLE IF NOT EXISTS operations(invoice_id TEXT NOT NULL,action TEXT NOT NULL,created INTEGER NOT NULL,complete INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(invoice_id,action));
 CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,created INTEGER NOT NULL);`);
 let pending=Promise.resolve();
 const serial=fn=>{const job=pending.then(fn);pending=job.catch(()=>{});return job;};
 const owner=s=>{if(!s?.company_id||s.role!=='Owner')fail(403,'Only the company owner can manage Stripe invoicing.');};
 const member=s=>{if(!s?.company_id||!['Owner','Manager'].includes(s.role))fail(403,'Only owners and managers can view Stripe invoices.');};
 const external=async fn=>{try{return await fn();}catch(e){if(e.status)throw e;fail(502,'Stripe could not complete this step. Retry the same request; do not create a replacement invoice.');}};
 const account=s=>{const a=db.prepare('SELECT * FROM accounts WHERE company=?').get(s.company_id);if(!a?.account||a.disconnected)fail(409,'Complete Stripe onboarding first.');return a;};
 const options=(a,key)=>({stripeAccount:a.account,...(key?{idempotencyKey:key}:{})});
 const metadata=(s,id)=>({contractorsight_company:s.company_id,contractorsight_invoice:id});
 function recent(created){if(now()-created>23*3600000)fail(409,'This unfinished Stripe request is over 23 hours old. Contact support to reconcile it before retrying.');}
 function project(s,id){
  if(typeof id!=='string'||!/^[\w-]{1,100}$/.test(id))fail(400,'Choose a project.');
  if(projectExists){if(!projectExists(s.company_id,id))fail(404,'Project not found.');return;}
  const file=join(dataDir,'companies',s.company_id,'contractoros.sqlite');if(!existsSync(file))fail(404,'Project not found.');
  const workspace=new DatabaseSync(file,{readOnly:true});try{if(!workspace.prepare('SELECT 1 FROM projects WHERE id=?').get(id))fail(404,'Project not found.');}finally{workspace.close();}
 }
 async function refreshAccount(a){
  const remote=await external(()=>stripe.v2.core.accounts.retrieve(a.account,{include:['configuration.merchant','requirements','defaults']}));
  if(remote.id!==a.account||remote.livemode!==live)fail(409,'Stripe account environment does not match.');
  if(remote.dashboard!=='full'||remote.defaults?.responsibilities?.fees_collector!=='stripe'||remote.defaults?.responsibilities?.losses_collector!=='stripe'||remote.metadata?.contractorsight_company!==a.company)fail(409,'Stripe account configuration needs review.');
  const active=remote.configuration?.merchant?.capabilities?.card_payments?.status==='active';
  db.prepare('UPDATE accounts SET active=? WHERE company=?').run(active?1:0,a.company);
  return {account_id:a.account,active,requirements:remote.requirements?.summary?.minimum_deadline?.status||null,dashboard_url:'https://dashboard.stripe.com/'};
 }
 async function requireActive(a){const state=await refreshAccount(a);if(!state.active)fail(409,'Stripe still needs onboarding or verification. Open Stripe to finish setup.');}
 function local(s,id){const row=db.prepare('SELECT * FROM invoices WHERE company=? AND id=?').get(s.company_id,id);if(!row)fail(404,'Invoice not found.');return row;}
 function view(row){const data=JSON.parse(row.payload);return {id:row.id,project_id:row.project,status:row.status,complete:!!row.complete,url:row.url,amount_due:row.amount_due,amount_paid:row.amount_paid,currency:row.currency,sent:!!row.sent,customer_name:data.customer.name,items:data.items,created:row.created};}
 function sync(row,remote){
  if(remote.id!==row.invoice||remote.livemode!==live||objectId(remote.customer)!==row.customer||remote.metadata?.contractorsight_company!==row.company||remote.metadata?.contractorsight_invoice!==row.id)fail(409,'Stripe invoice ownership does not match.');
  if(remote.application_fee_amount!=null&&remote.application_fee_amount!==0||remote.transfer_data)fail(409,'Unexpected invoice fee or transfer configuration.');
  const url=remote.hosted_invoice_url?stripeUrl(remote.hosted_invoice_url,'invoice.stripe.com'):null;
  db.prepare('UPDATE invoices SET status=?,url=?,amount_due=?,amount_paid=?,currency=? WHERE id=?').run(remote.status||'deleted',url,remote.amount_due||0,remote.amount_paid||0,remote.currency||'usd',row.id);
  return view(local({company_id:row.company},row.id));
 }
 function validated(body){
  const name=text(body.customer?.name,160),email=text(body.customer?.email,254);
  if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter the customer name and email.');
  if(!Array.isArray(body.items)||!body.items.length||body.items.length>50)fail(400,'Add between 1 and 50 invoice items.');
  let total=0;const items=body.items.map(item=>{const description=text(item.description,500),quantity=item.quantity??1,unit_amount=item.unit_amount;if(!description||!Number.isSafeInteger(quantity)||quantity<1||quantity>10000||!Number.isSafeInteger(unit_amount)||unit_amount<1)fail(400,'Items need a description, positive whole quantity and price in cents.');const amount=quantity*unit_amount;total+=amount;return {description,quantity,unit_amount,amount};});
  if(!Number.isSafeInteger(total)||total>99999999)fail(400,'Invoice total exceeds the supported limit.');
  const days=body.days_until_due??30;if(!Number.isInteger(days)||days<1||days>365)fail(400,'Choose a due period between 1 and 365 days.');
  return {project_id:body.project_id,customer:{name,email},items,days_until_due:days,currency:'usd'};
 }
 async function create(s,body){
  owner(s);project(s,body.project_id);if(!uuid(body.request_id))fail(400,'A request ID is required.');
  const payload=JSON.stringify(validated(body)),a=account(s);await requireActive(a);
  let row=db.prepare('SELECT * FROM invoices WHERE company=? AND request_id=?').get(s.company_id,body.request_id);
  if(row&&row.payload!==payload)fail(409,'This request ID belongs to different invoice details.');
  if(!row){const id=randomUUID();db.prepare('INSERT INTO invoices(id,company,project,request_id,payload,created) VALUES(?,?,?,?,?,?)').run(id,s.company_id,body.project_id,body.request_id,payload,now());row=local(s,id);}
  if(row.complete)return view(row);recent(row.created);
  const data=JSON.parse(row.payload),meta=metadata(s,row.id),key=`cs-invoice-${row.id}`;
  if(!row.customer){const customer=await external(()=>stripe.customers.create({...data.customer,metadata:meta},options(a,key+'-customer')));if(customer.livemode!==live)fail(409,'Stripe environment does not match.');db.prepare('UPDATE invoices SET customer=? WHERE id=?').run(customer.id,row.id);row=local(s,row.id);}
  if(!row.invoice){const invoice=await external(()=>stripe.invoices.create({customer:row.customer,collection_method:'send_invoice',days_until_due:data.days_until_due,currency:data.currency,auto_advance:false,pending_invoice_items_behavior:'exclude',application_fee_amount:0,metadata:meta},options(a,key+'-draft')));if(invoice.livemode!==live)fail(409,'Stripe environment does not match.');db.prepare('UPDATE invoices SET invoice=? WHERE id=?').run(invoice.id,row.id);row=local(s,row.id);}
  for(const [index,item] of data.items.entries())await external(()=>stripe.invoiceItems.create({customer:row.customer,invoice:row.invoice,currency:data.currency,amount:item.amount,description:`${item.description} (${item.quantity} × ${(item.unit_amount/100).toFixed(2)} USD)`,metadata:meta},options(a,key+'-item-'+index)));
  const remote=await external(()=>stripe.invoices.retrieve(row.invoice,options(a)));sync(row,remote);
  db.prepare('UPDATE invoices SET complete=1 WHERE id=?').run(row.id);return view(local(s,row.id));
 }
 async function action(s,id,action){
  owner(s);const row=local(s,id),a=account(s);if(!row.complete)fail(409,'Finish creating this draft before continuing.');
  if(!['finalize','send','sync'].includes(action))fail(404,'Invoice action not found.');
  let remote=await external(()=>stripe.invoices.retrieve(row.invoice,options(a)));sync(row,remote);
  if(action==='sync')return view(local(s,id));
  await requireActive(a);
  if(action==='finalize'&&remote.status!=='draft')return view(local(s,id));
  if(action==='send'&&(row.sent||remote.status==='paid'))return view(local(s,id));
  if(action==='send'&&remote.status!=='open')fail(409,'Finalize the invoice before sending it.');
  let op=db.prepare('SELECT * FROM operations WHERE invoice_id=? AND action=?').get(id,action);
  if(op?.complete){if(action==='send')db.prepare('UPDATE invoices SET sent=1 WHERE id=?').run(id);return view(local(s,id));}
  if(!op){db.prepare('INSERT INTO operations(invoice_id,action,created) VALUES(?,?,?)').run(id,action,now());op={created:now()};}else if(!op.complete)recent(op.created);
  const opts=options(a,`cs-invoice-${id}-${action}`);
  remote=await external(()=>action==='finalize'?stripe.invoices.finalizeInvoice(row.invoice,{auto_advance:false},opts):stripe.invoices.sendInvoice(row.invoice,{},opts));
  sync(row,remote);db.prepare('UPDATE operations SET complete=1 WHERE invoice_id=? AND action=?').run(id,action);
  if(action==='send')db.prepare('UPDATE invoices SET sent=1 WHERE id=?').run(id);
  return view(local(s,id));
 }
 async function onboarding(s){
  owner(s);let a=db.prepare('SELECT * FROM accounts WHERE company=?').get(s.company_id);
  if(a?.disconnected)fail(409,'This Stripe connection was disconnected. Contact support before reconnecting.');
  if(!a){const payload=JSON.stringify({contact_email:s.email,dashboard:'full',identity:{country:'US'},defaults:{responsibilities:{fees_collector:'stripe',losses_collector:'stripe'}},configuration:{merchant:{capabilities:{card_payments:{requested:true}}}},metadata:{contractorsight_company:s.company_id}});db.prepare('INSERT INTO accounts(company,request_id,created,payload) VALUES(?,?,?,?)').run(s.company_id,randomUUID(),now(),payload);a=db.prepare('SELECT * FROM accounts WHERE company=?').get(s.company_id);}
  if(!a.account){recent(a.created);const remote=await external(()=>stripe.v2.core.accounts.create(JSON.parse(a.payload),{idempotencyKey:'cs-connect-'+a.request_id}));if(remote.livemode!==live)fail(409,'Stripe account environment does not match.');db.prepare('UPDATE accounts SET account=? WHERE company=?').run(remote.id,s.company_id);a=account(s);}
  // Return to an authenticated page; it checks status and offers a fresh link after expiry.
  const link=await external(()=>stripe.v2.core.accountLinks.create({account:a.account,use_case:{type:'account_onboarding',account_onboarding:{configurations:['merchant'],refresh_url:origin+'/invoicing.html?refresh=1',return_url:origin+'/invoicing.html?returned=1'}}}));
  return {url:stripeUrl(link.url,'connect.stripe.com')};
 }
 async function webhook(raw,signature,kind='invoices'){
  let event;try{event=kind==='accounts'?stripe.parseEventNotification(raw,signature,accountWebhookSecret):stripe.webhooks.constructEvent(raw,signature,webhookSecret);}catch{fail(400,'Invalid Stripe webhook signature.');}
  return serial(async()=>{
   if(event.livemode!==live||db.prepare('SELECT 1 FROM events WHERE id=?').get(event.id))return {received:true};
   if(event.type==='account.application.deauthorized'){
    db.prepare('UPDATE accounts SET disconnected=1,active=0 WHERE account=?').run(event.account||'');
   }else if(event.type==='account.updated'||event.type.startsWith('v2.core.account[')||event.type==='v2.core.account.updated'){
    const id=event.type==='account.updated'?event.data?.object?.id:event.related_object?.id;
    const a=db.prepare('SELECT * FROM accounts WHERE account=?').get(id||'');if(a&&!a.disconnected)await refreshAccount(a);
   }else if(CONNECT_INVOICE_EVENTS.includes(event.type)&&event.account){
    const a=db.prepare('SELECT * FROM accounts WHERE account=?').get(event.account);
    const row=a&&db.prepare('SELECT * FROM invoices WHERE company=? AND invoice=?').get(a.company,event.data?.object?.id||'');
    if(row&&!a.disconnected){if(event.type==='invoice.deleted'){if(event.data.object.livemode!==live||event.data.object.id!==row.invoice)fail(400,'Invalid invoice event.');db.prepare("UPDATE invoices SET status='deleted',url=NULL WHERE id=?").run(row.id);}else{const remote=await external(()=>stripe.invoices.retrieve(row.invoice,options(a)));sync(row,remote);if(event.type==='invoice.sent')db.prepare('UPDATE invoices SET sent=1 WHERE id=?').run(row.id);}}
   }
   db.prepare('INSERT INTO events VALUES(?,?)').run(event.id,now());return {received:true};
  });
 }
 return {ready:true,live,close:()=>db.close(),
  status:s=>serial(async()=>{member(s);const a=db.prepare('SELECT * FROM accounts WHERE company=?').get(s.company_id);return {enabled:true,mode,owner:s.role==='Owner',connected:!!a?.account,disconnected:!!a?.disconnected,...(a?.account&&!a.disconnected?await refreshAccount(a):{active:false})};}),
  onboarding:s=>serial(()=>onboarding(s)),create:(s,b)=>serial(()=>create(s,b)),action:(s,id,a)=>serial(()=>action(s,id,a)),
  resume:(s,id)=>serial(()=>{owner(s);const row=local(s,id);return create(s,{...JSON.parse(row.payload),request_id:row.request_id});}),
  list:(s,p)=>{member(s);if(p)project(s,p);return db.prepare('SELECT * FROM invoices WHERE company=?'+(p?' AND project=?':'')+' ORDER BY created DESC LIMIT 100').all(...(p?[s.company_id,p]:[s.company_id])).map(view);},webhook};
}


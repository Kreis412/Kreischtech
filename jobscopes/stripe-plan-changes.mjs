import {randomUUID} from 'node:crypto';
import {SUBSCRIPTION_PLANS} from './billing.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const id=v=>typeof v==='string'?v:v?.id;

// A plan change is a future phase of the SAME subscription, never another checkout.
export function stripePlanChanges({db,stripe,prices,live,now,memberCount,external}){
 db.exec(`CREATE TABLE IF NOT EXISTS plan_changes(id TEXT PRIMARY KEY,company TEXT NOT NULL,user_id TEXT NOT NULL,subscription TEXT NOT NULL,from_plan TEXT NOT NULL,to_plan TEXT NOT NULL,effective INTEGER NOT NULL,created INTEGER NOT NULL,state TEXT NOT NULL,schedule TEXT);`);
 const planFor=key=>SUBSCRIPTION_PLANS.find(p=>p.id===key)||fail(400,'Choose Solo, Pro or Team.');
 const owner=s=>{if(s.role!=='Owner')fail(403,'Only the company owner can change plans.');};
 const pending=company=>db.prepare("SELECT * FROM plan_changes WHERE company=? AND state IN ('creating','scheduled') AND effective>? ORDER BY created DESC LIMIT 1").get(company,now());
 const subFor=company=>{
  const rows=db.prepare("SELECT * FROM subscriptions WHERE company=? AND status NOT IN ('canceled','incomplete_expired')").all(company);
  if(rows.length!==1||rows[0].status!=='active'||rows[0].cancel_at_end)fail(409,'An active, renewing website subscription is required. Check payment status first.');
  return rows[0];
 };
 async function checkedSub(row){
  const sub=await external(()=>stripe.subscriptions.retrieve(row.id));
  const item=sub.items?.data?.[0];
  if(sub.livemode!==live||sub.status!=='active'||sub.cancel_at_period_end||sub.items?.data?.length!==1||item.quantity!==1||id(item.price)!==prices[row.plan]||item.current_period_end*1000!==row.period_end)fail(409,'Your subscription changed. Check payment status and try again.');
  return sub;
 }
 async function preview(session,key){
  owner(session);if(!live)fail(409,'Plan changes require live billing.');
  if(pending(session.company_id))fail(409,'A plan change is already scheduled. Cancel that change before choosing another.');
  const plan=planFor(key),row=subFor(session.company_id);
  if(row.plan===key)fail(409,'You already have this plan.');
  if(memberCount(session.company_id)>plan.seats)fail(409,`Remove extra company members before switching to ${plan.name} (${plan.seats} user${plan.seats===1?'':'s'}).`);
  const sub=await checkedSub(row);if(sub.schedule)fail(409,'This subscription already has a schedule. Contact support to change it.');
  const price=await external(()=>stripe.prices.retrieve(prices[key]));
  if(!price||price.livemode!==live||!price.active||price.currency!=='usd'||price.unit_amount!==plan.price_cents||price.type!=='recurring'||price.billing_scheme!=='per_unit'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1)fail(503,'The new plan price is not configured correctly.');
  if(row.period_end<now()+60000)fail(409,'Your renewal is processing. Check payment status shortly and try again.');
  const quote={id:randomUUID(),company:session.company_id,user_id:session.user_id,subscription:row.id,from_plan:row.plan,to_plan:key,effective:row.period_end,created:now()};
  db.prepare("INSERT INTO plan_changes VALUES(?,?,?,?,?,?,?,?, 'quoted',NULL)").run(quote.id,quote.company,quote.user_id,quote.subscription,quote.from_plan,key,quote.effective,quote.created);
  return {quote_id:quote.id,plan:plan.name,price_cents:plan.price_cents,effective_at:quote.effective,currency:'USD'};
 }
 async function confirm(session,quoteId){
  owner(session);
  if(typeof quoteId!=='string'||quoteId.length>100)fail(400,'Invalid plan confirmation.');
  const q=db.prepare('SELECT * FROM plan_changes WHERE id=? AND company=? AND user_id=?').get(quoteId||'',session.company_id,session.user_id);
  if(!q)fail(404,'Plan change not found.');
  if(q.state==='scheduled')return {scheduled:true,effective_at:q.effective};
  if(!['quoted','creating'].includes(q.state)||q.effective<=now()+30000||(q.state==='quoted'&&q.created<now()-600000))fail(409,'This confirmation expired. Choose the plan again.');
  const other=pending(q.company);if(other&&other.id!==q.id)fail(409,'A different plan change is already being processed.');
  const plan=planFor(q.to_plan),row=subFor(q.company);
  if(row.id!==q.subscription||row.plan!==q.from_plan||row.period_end!==q.effective||memberCount(q.company)>plan.seats)fail(409,'Your company or subscription changed. Choose the plan again.');
  const sub=await checkedSub(row);
  const price=await external(()=>stripe.prices.retrieve(prices[q.to_plan]));
  if(!price?.active||price.livemode!==live||price.currency!=='usd'||price.unit_amount!==plan.price_cents||price.billing_scheme!=='per_unit'||price.type!=='recurring'||price.recurring?.interval!=='month'||price.recurring?.interval_count!==1)fail(409,'The plan price changed. Contact support before continuing.');
  if(sub.schedule&&id(sub.schedule)!==q.schedule&&q.state!=='creating')fail(409,'Another subscription schedule already exists.');
  db.prepare("UPDATE plan_changes SET state='creating' WHERE id=?").run(q.id);
  // Persist the request identity BEFORE contacting Stripe: a lost response can be retried.
  const schedule=q.schedule?await external(()=>stripe.subscriptionSchedules.retrieve(q.schedule)):await external(()=>stripe.subscriptionSchedules.create({from_subscription:sub.id},{idempotencyKey:'cs-plan-create:'+q.id}));
  if(id(schedule.subscription)!==sub.id||schedule.livemode!==live||!schedule.current_phase||schedule.current_phase.end_date*1000!==q.effective)fail(409,'Stripe returned a different subscription schedule. Contact support.');
  db.prepare('UPDATE plan_changes SET schedule=? WHERE id=?').run(schedule.id,q.id);
  await external(()=>stripe.subscriptionSchedules.update(schedule.id,{end_behavior:'release',proration_behavior:'none',phases:[
   {start_date:schedule.current_phase.start_date,end_date:q.effective/1000,items:[{price:prices[q.from_plan],quantity:1}],proration_behavior:'none'},
   {start_date:q.effective/1000,duration:{interval:'month',interval_count:1},items:[{price:prices[q.to_plan],quantity:1}],proration_behavior:'none'}
  ]},{idempotencyKey:'cs-plan-update:'+q.id}));
  db.prepare("UPDATE plan_changes SET state='scheduled' WHERE id=?").run(q.id);
  return {scheduled:true,effective_at:q.effective};
 }
 async function cancel(session){
  owner(session);const q=pending(session.company_id);if(!q)fail(404,'No future plan change to cancel.');
  if(q.state!=='scheduled'||!q.schedule)fail(409,'Finish checking the pending change before canceling it.');
  await external(()=>stripe.subscriptionSchedules.release(q.schedule,{}, {idempotencyKey:'cs-plan-release:'+q.id}));
  db.prepare("UPDATE plan_changes SET state='canceled' WHERE id=?").run(q.id);
  return {canceled:true};
 }
 const allowed=(subscription,key,at)=>Number.isFinite(at)&&!!db.prepare("SELECT 1 FROM plan_changes WHERE subscription=? AND to_plan=? AND state='scheduled' AND effective<=?").get(subscription,key,at);
 async function releaseCompletedSchedule(subscription){
  const sub=await external(()=>stripe.subscriptions.retrieve(subscription));if(!sub.schedule)return;
  const q=db.prepare("SELECT * FROM plan_changes WHERE subscription=? AND schedule=? AND state='scheduled' AND effective<=?").get(subscription,id(sub.schedule),now());
  if(!q)fail(409,'Contact support to cancel this scheduled subscription.');
  await external(()=>stripe.subscriptionSchedules.release(q.schedule,{}, {idempotencyKey:'cs-plan-finished-release:'+q.id}));
 }
 return {preview,confirm,cancel,allowed,pending,releaseCompletedSchedule,
  status:company=>{const q=pending(company);return q?{quote_id:q.id,plan:q.to_plan,effective_at:q.effective,state:q.state}:null;},
  seatCap:company=>{const q=pending(company);return q?planFor(q.to_plan).seats:Infinity;}
 };
}

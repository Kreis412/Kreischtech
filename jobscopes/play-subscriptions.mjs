import {createHash} from 'node:crypto';
import {SUBSCRIPTION_PLANS} from './billing.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const hash=value=>createHash('sha256').update(value).digest('hex');
const allowedStates=['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_CANCELED','SUBSCRIPTION_STATE_IN_GRACE_PERIOD'];
// Product IDs must be explicitly enabled after their monthly base plans are configured in Play.
export function playSubscriptions({db,credits,client,products={},allowTest,now,memberCount=()=>1,otherSubscription=()=>false}){
 db.exec(`CREATE TABLE IF NOT EXISTS play_subscriptions(token_hash TEXT PRIMARY KEY,token TEXT NOT NULL,company TEXT NOT NULL,user_id TEXT NOT NULL,product TEXT NOT NULL,plan TEXT NOT NULL,state TEXT NOT NULL,expires INTEGER NOT NULL,checked INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS play_replacements(old_hash TEXT PRIMARY KEY,new_hash TEXT NOT NULL UNIQUE);
 CREATE TABLE IF NOT EXISTS play_next_plans(token_hash TEXT PRIMARY KEY,product TEXT NOT NULL,effective INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS play_subscription_periods(order_id TEXT PRIMARY KEY,token_hash TEXT NOT NULL,company TEXT NOT NULL,plan TEXT NOT NULL,expires INTEGER NOT NULL);`);
 const catalog=SUBSCRIPTION_PLANS.filter(p=>typeof products[p.id]==='string'&&/^[a-z][a-z0-9_.]{1,100}$/.test(products[p.id])).map(p=>({...p,id:products[p.id],plan:p.id}));
 if(new Set(catalog.map(p=>p.id)).size!==catalog.length)throw Error('Google Play subscription products must be unique.');
 const planFor=product=>catalog.find(p=>p.id===product)||fail(400,'Choose a configured subscription.');
 const active=company=>db.prepare('SELECT * FROM play_subscriptions WHERE company=? AND expires>?').all(company,now()).filter(r=>allowedStates.includes(r.state));
 function revokePeriods(row,exceptOrder){
  for(const period of db.prepare('SELECT * FROM play_subscription_periods WHERE token_hash=? AND expires>?').all(row.token_hash,now())){
   if(period.order_id===exceptOrder)continue;
   for(const kind of ['analysis','joe']){
    const id=`play-sub:${kind}:${hash(period.order_id)}`;
    if(credits.grantInfo(id,row.company))credits.adjust(id,row.company,0,'Google Play subscription reconciliation');
   }
  }
 }
 async function apply(row,p){
  if(row.state==='REPLACED')fail(409,'This subscription has been replaced. Restore your current subscription.');
  if(p.testPurchase&&!allowTest)fail(400,'Test purchases are not enabled on this server.');
  if(p.subscriptionState==='SUBSCRIPTION_STATE_PENDING')return {confirmed:false,pending:true};
  const items=p.lineItems||[];
  if(!items.length||items.length>2||items.some(i=>!catalog.some(c=>c.id===i.productId)||i.offerDetails?.basePlanId!=='monthly'))fail(409,'Google Play subscription does not match the configured monthly plans.');
  const current=items.filter(i=>Date.parse(i.expiryTime)>now());
  if(current.length>1)fail(409,'Multiple active subscription items need support review.');
  const item=current[0]||items.find(i=>i.productId===row.product&&i.expiryTime);
  if(!item)fail(409,'Google has not confirmed the current subscription period.');
  const future=items.find(i=>!i.expiryTime);
  if(future&&item.deferredItemReplacement?.productId!==future.productId)fail(409,'Google has not confirmed this future plan change.');
  const plan=planFor(item.productId),expires=Date.parse(item.expiryTime),state=p.subscriptionState;
  if(!Number.isSafeInteger(expires))fail(502,'Google returned an invalid subscription expiry.');
  let previous;
  if(p.linkedPurchaseToken){
   previous=db.prepare('SELECT * FROM play_subscriptions WHERE token_hash=?').get(hash(p.linkedPurchaseToken));
   if(!previous||previous.company!==row.company||previous.user_id!==row.user_id||previous.token_hash===row.token_hash)fail(409,'Contact support to restore this replaced subscription.');
   const replacement=db.prepare('SELECT * FROM play_replacements WHERE old_hash=?').get(previous.token_hash);
   if(replacement&&replacement.new_hash!==row.token_hash)fail(409,'This previous subscription was already replaced by another purchase.');
  }
  const eligible=allowedStates.includes(state)&&expires>now();
  const order=item.latestSuccessfulOrderId;
  if(eligible&&(typeof order!=='string'||!order||order.length>200))fail(502,'Google has not confirmed a paid billing period yet.');
  const existing=eligible?db.prepare('SELECT * FROM play_subscription_periods WHERE order_id=?').get(order):null;
  if(existing&&(existing.company!==row.company||(existing.token_hash!==row.token_hash&&existing.token_hash!==previous?.token_hash)||existing.plan!==plan.plan))fail(409,'This billing period already belongs to another purchase.');
  // Grace periods do not award another month's allowance for an unpaid renewal.
  if(eligible&&state==='SUBSCRIPTION_STATE_IN_GRACE_PERIOD'&&!existing)fail(409,'Restore the subscription after Google confirms payment.');
  // Complete all validation before replacing the previous receipt or touching credits.
  if(previous){
   db.prepare('INSERT OR IGNORE INTO play_replacements VALUES(?,?)').run(previous.token_hash,row.token_hash);
   revokePeriods(previous,eligible?order:undefined);
   if(existing?.token_hash===previous.token_hash)db.prepare('UPDATE play_subscription_periods SET token_hash=? WHERE order_id=?').run(row.token_hash,order);
   db.prepare("UPDATE play_subscriptions SET state='REPLACED',expires=0 WHERE token_hash=?").run(previous.token_hash);
   db.prepare('DELETE FROM play_next_plans WHERE token_hash=?').run(previous.token_hash);
  }
  db.prepare('DELETE FROM play_next_plans WHERE token_hash=?').run(row.token_hash);
  if(future&&eligible&&state==='SUBSCRIPTION_STATE_ACTIVE')db.prepare('INSERT INTO play_next_plans VALUES(?,?,?)').run(row.token_hash,future.productId,expires);
  db.prepare(`INSERT INTO play_subscriptions VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET product=excluded.product,plan=excluded.plan,state=excluded.state,expires=excluded.expires,checked=excluded.checked`).run(row.token_hash,row.token,row.company,row.user_id,item.productId,plan.plan,state,expires,now());
  if(!eligible){revokePeriods(row);return {confirmed:false,pending:state==='SUBSCRIPTION_STATE_PENDING'};}
  if(!existing)db.prepare('INSERT INTO play_subscription_periods VALUES(?,?,?,?,?)').run(order,row.token_hash,row.company,plan.plan,expires);
  revokePeriods(row,order);
  const periodEnd=existing?.expires??expires;
  // Preserve the original monthly deadline if Google extends grace time.
  if(periodEnd>now())for(const [kind,amount] of [['analysis',plan.analyses],['joe',plan.joe_answers]]){
   const id=`play-sub:${kind}:${hash(order)}`;
   credits.grant({id,company:row.company,kind,amount,expires:periodEnd});
   credits.adjust(id,row.company,amount,'Google Play paid subscription period');
  }
  if(p.acknowledgementState==='ACKNOWLEDGEMENT_STATE_PENDING')await client.acknowledge(future?.productId||item.productId,row.token);
  const scheduled=!!future&&state==='SUBSCRIPTION_STATE_ACTIVE';
  return {confirmed:true,scheduled,effective_at:scheduled?expires:undefined,balance:credits.balance(row.company),joe_balance:credits.balance(row.company,'joe')};
 }
 async function confirm(session,product,token){
  planFor(product);const tokenHash=hash(token),purchase=await client.subscription(token);
  if(!purchase?.lineItems?.some(i=>i.productId===product))fail(409,'Purchase does not contain this plan.');
  let row=db.prepare('SELECT * FROM play_subscriptions WHERE token_hash=?').get(tokenHash);
  if(row&&(row.company!==session.company_id||row.user_id!==session.user_id))fail(409,'This subscription belongs to another account or company.');
  if(row?.state==='REPLACED')return {confirmed:false,superseded:true};
  if(!row){
   const previous=purchase.linkedPurchaseToken?db.prepare('SELECT * FROM play_subscriptions WHERE token_hash=?').get(hash(purchase.linkedPurchaseToken)):null;
   if(otherSubscription(session.company_id)||(active(session.company_id).length&&(!previous||previous.company!==session.company_id||previous.user_id!==session.user_id)))fail(409,'Your company already has a subscription. Contact support before purchasing another.');
   if(!previous&&memberCount(session.company_id)>planFor(product).seats)fail(409,'Company membership exceeds this plan. Contact support before restoring.');
   row={token_hash:tokenHash,token,company:session.company_id,user_id:session.user_id,product};
  }
  return apply(row,purchase);
 }
 async function reconcile(company,force){
  for(const row of db.prepare("SELECT * FROM play_subscriptions WHERE company=? AND checked<=? AND state NOT IN ('REPLACED','SUBSCRIPTION_STATE_EXPIRED','SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED')").all(company,force?now():now()-900000))await apply(row,await client.subscription(row.token));
 }
 function prepare(session,product){
  const plan=planFor(product);
  if(otherSubscription(session.company_id)||active(session.company_id).length)fail(409,'Your company already has a subscription. Manage it before purchasing another.');
  if(memberCount(session.company_id)>plan.seats)fail(409,`${plan.name} includes ${plan.seats} users. Remove extra members before purchasing.`);
  return {ready:true};
 }
 async function prepareChange(session,product){
  await reconcile(session.company_id,true);
  const rows=active(session.company_id),plan=planFor(product);
  if(otherSubscription(session.company_id)||rows.length!==1||rows[0].user_id!==session.user_id||rows[0].state!=='SUBSCRIPTION_STATE_ACTIVE')fail(409,'Use the account that owns your active Google Play subscription. Website subscriptions must be changed on the website.');
  const row=rows[0];
  if(row.product===product)fail(409,'You already have this plan.');
  if(db.prepare('SELECT 1 FROM play_next_plans WHERE token_hash=?').get(row.token_hash))fail(409,'A plan change is already scheduled. Manage it in Google Play.');
  if(memberCount(session.company_id)>plan.seats)fail(409,`Remove extra company members before switching to ${plan.name} (${plan.seats} users).`);
  if(row.expires<=now()+60000)fail(409,'Your renewal is processing. Try again shortly.');
  return {ready:true,effective_at:row.expires,replacement:{oldSku:row.product,purchaseToken:row.token,prorationMode:'deferred'}};
 }
 const nextPlan=company=>db.prepare('SELECT n.* FROM play_next_plans n JOIN play_subscriptions s ON s.token_hash=n.token_hash WHERE s.company=? AND n.effective>?').get(company,now());
 return {catalog,confirm,reconcile,active,prepare,prepareChange,
  scheduled:company=>{const n=nextPlan(company);return n?{plan:planFor(n.product).plan,effective_at:n.effective}:null;},
  hasPaidCompany:company=>!!db.prepare('SELECT 1 FROM play_subscriptions WHERE company=?').get(company),
  seatLimit:company=>Math.min(nextPlan(company)?planFor(nextPlan(company).product).seats:Infinity,Math.max(1,...active(company).map(r=>SUBSCRIPTION_PLANS.find(p=>p.id===r.plan)?.seats||1))),
  status:company=>active(company).map(r=>({plan:r.plan,state:r.state,period_end:r.expires}))};
}

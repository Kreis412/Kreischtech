import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {ANALYSIS_PACKS,CARRYOVER_EXPIRY,billingStore} from './billing.mjs';
import {paidUsage} from './paid-usage.mjs';
import {playSubscriptions} from './play-subscriptions.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function playBilling({dataDir,client,enabled=false,allowTest=false,products={},memberCount=()=>1,otherSubscription=()=>false,now=()=>Date.now()}={}){
 // Share the existing LIVE credit ledger; test Stripe grants remain separate.
 const directory=join(dataDir,'stripe-live');mkdirSync(directory,{recursive:true});
 const credits=billingStore(directory,{now}),db=new DatabaseSync(join(directory,'google-play.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS play_receipts(token_hash TEXT PRIMARY KEY,token TEXT NOT NULL,company TEXT NOT NULL,user_id TEXT NOT NULL,product TEXT NOT NULL,quantity INTEGER NOT NULL,created INTEGER NOT NULL,checked INTEGER NOT NULL DEFAULT 0,revoked INTEGER NOT NULL DEFAULT 0);`);
 const ready=!!(enabled&&client);let pending=Promise.resolve();const attempts=new Map();
 const subscriptions=playSubscriptions({db,credits,client,products,allowTest,now,memberCount,otherSubscription});
 function rateLimit(company){
  for(const [key,value] of attempts)if(value.until<=now())attempts.delete(key);
  const entry=attempts.get(company)||{until:now()+60000,count:0};
  if(++entry.count>20)fail(429,'Please wait a minute before checking purchases again.');
  attempts.set(company,entry);
 }
 const serial=fn=>{const result=pending.then(fn);pending=result.catch(()=>{});return result;};
 const packFor=id=>ANALYSIS_PACKS.find(p=>p.id===id)||fail(400,'Choose a valid analysis pack.');
 const owner=s=>{if(s.role!=='Owner')fail(403,'Only the company owner can buy or restore credits.');};
 const receiptFor=hash=>db.prepare('SELECT * FROM play_receipts WHERE token_hash=?').get(hash);
 function validate(p,product){
  if(p.productId&&p.productId!==product)fail(400,'Purchase product does not match.');
  if(p.purchaseType===0&&!allowTest)fail(400,'Test purchases are not enabled on this server.');
  const quantity=p.quantity??1;if(!Number.isSafeInteger(quantity)||quantity<1||quantity>100)fail(400,'Invalid purchase quantity.');
  return quantity;
 }
 function entitlement(row,p){
  const pack=packFor(row.product),quantity=validate(p,row.product);
  if(quantity!==row.quantity)fail(409,'Purchase quantity changed unexpectedly.');
  const remaining=p.refundableQuantity??quantity;
  if(!Number.isSafeInteger(remaining)||remaining<0||remaining>quantity)fail(502,'Google returned an invalid purchase balance.');
  const amount=quantity*pack.analyses,available=p.purchaseState===0?remaining*pack.analyses:0;
  credits.grant({id:'play:'+row.token_hash,company:row.company,amount,available,expires:CARRYOVER_EXPIRY});
  credits.adjust('play:'+row.token_hash,row.company,available,'Google Play purchase reconciliation');
  db.prepare('UPDATE play_receipts SET checked=?,revoked=? WHERE token_hash=?').run(now(),available===0?1:0,row.token_hash);
 }
 async function confirm(session,product,token){
  owner(session);if(!ready)fail(503,'Google Play purchases are not connected yet.');
  if(typeof token!=='string'||token.length<10||token.length>4096)fail(400,'Invalid purchase receipt.');
  rateLimit(session.company_id);
  if(subscriptions.catalog.some(p=>p.id===product))return serial(()=>subscriptions.confirm(session,product,token));
  packFor(product);
  return serial(async()=>{
   const hash=createHash('sha256').update(token).digest('hex');let row=receiptFor(hash);
   if(row&&(row.company!==session.company_id||row.user_id!==session.user_id||row.product!==product))fail(409,'This purchase belongs to a different account or company.');
   const p=await client.get(product,token),quantity=validate(p,product);
   if(p.purchaseState===2)return {confirmed:false,pending:true};
   if(p.purchaseState!==0){if(row)entitlement(row,p);fail(409,'This purchase is canceled or refunded.');}
   if(!row){
    if(p.consumptionState!==0)fail(409,'This purchase was already delivered. Contact support if credits are missing.');
    db.prepare('INSERT INTO play_receipts(token_hash,token,company,user_id,product,quantity,created) VALUES(?,?,?,?,?,?,?)').run(hash,token,session.company_id,session.user_id,product,quantity,now());row=receiptFor(hash);
   }
   // Persist credits before consuming. A retry repairs crashes without issuing a second grant.
   entitlement(row,p);
   if(p.consumptionState===0)await client.consume(product,token);
   return {confirmed:true,balance:credits.balance(session.company_id),carryover_balance:credits.carryoverBalance(session.company_id)};
  });
 }
 async function reconcile(company,force=false){
  if(!client)return;
  if(force)rateLimit(company);
  return serial(async()=>{
   await subscriptions.reconcile(company,force);
   for(const row of db.prepare('SELECT * FROM play_receipts WHERE company=? AND revoked=0 AND checked<=?').all(company,force?now():now()-900000)){
    const p=await client.get(row.product,row.token);entitlement(row,p);
    if(p.purchaseState===0&&p.consumptionState===0)await client.consume(row.product,row.token);
   }
  });
 }
 return {ready,confirm,reconcile,
  prepareChange:(s,product)=>{owner(s);if(!ready)fail(503,'Google Play purchases are not connected.');rateLimit(s.company_id);return serial(()=>subscriptions.prepareChange(s,product));},
  prepare:(s,product)=>{owner(s);if(!ready)fail(503,'Google Play purchases are not connected.');return subscriptions.catalog.some(p=>p.id===product)?subscriptions.prepare(s,product):(packFor(product),{ready:true});},
  status:s=>({ready,purchase_enabled:ready&&s.role==='Owner',scheduled_change:subscriptions.scheduled(s.company_id),plans:subscriptions.catalog,subscriptions:subscriptions.status(s.company_id),has_subscription:!!subscriptions.active(s.company_id).length||otherSubscription(s.company_id),packs:ANALYSIS_PACKS,balance:credits.balance(s.company_id),joe_balance:credits.balance(s.company_id,'joe'),carryover_balance:credits.carryoverBalance(s.company_id)}),
  hasSubscription:company=>!!subscriptions.active(company).length,
  seatLimit:subscriptions.seatLimit,
  hasPaidCompany:company=>subscriptions.hasPaidCompany(company)||!!db.prepare('SELECT 1 FROM play_receipts WHERE company=? LIMIT 1').get(company),
  balance:(company,kind)=>credits.balance(company,kind),
  runSaved:company=>async(...args)=>{await reconcile(company);return paidUsage(credits,company)(...args);},
  close(){db.close();credits.close();}
 };
}

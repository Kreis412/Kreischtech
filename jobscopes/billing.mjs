import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';

// Prices are proposals until payment verification, seat enforcement and store billing ship.
export const PLANS = Object.freeze([
 Object.freeze({id:'solo',name:'Solo',price_cents:1900,interval:'month',seats:1,analyses:25}),
 Object.freeze({id:'crew',name:'Crew',price_cents:3900,interval:'month',seats:5,analyses:60}),
 Object.freeze({id:'pack',name:'Pay as you go',price_cents:1000,interval:'pack',seats:1,analyses:10})
]);
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const identifier=value=>{if(typeof value!=='string'||!value.trim()||value.length>250)fail(400,'Invalid ledger identifier.');return value;};

// Server-only accounting primitives. No public endpoint can grant credits or mark a payment paid.
// Do not activate until provider receipts/webhooks and post-save analysis settlement are integrated.
export function billingStore(dataDir,{now=()=>Date.now()}={}) {
 const db=new DatabaseSync(join(dataDir,'billing.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS credit_grants(
 id TEXT PRIMARY KEY, company TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('analysis','joe')),
 amount INTEGER NOT NULL CHECK(amount>0), expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS credit_requests(
 company TEXT NOT NULL, request_key TEXT NOT NULL, kind TEXT NOT NULL,
 grant_id TEXT NOT NULL REFERENCES credit_grants(id),
 state TEXT NOT NULL CHECK(state IN ('reserved','completed','refunded')),
 PRIMARY KEY(company,request_key));
 CREATE TABLE IF NOT EXISTS credit_adjustments(
 grant_id TEXT PRIMARY KEY REFERENCES credit_grants(id), available INTEGER NOT NULL CHECK(available>=0), reason TEXT NOT NULL);`);
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
 function grants(company,kind){return db.prepare(`SELECT g.*, coalesce(a.available,g.amount) allowance,
 (SELECT count(*) FROM credit_requests r WHERE r.grant_id=g.id AND r.state!='refunded') used
 FROM credit_grants g LEFT JOIN credit_adjustments a ON a.grant_id=g.id WHERE company=? AND kind=? AND expires>? ORDER BY expires,id`).all(company,kind,now());}
 function balance(company,kind='analysis'){
  identifier(company);return grants(company,kind).reduce((n,g)=>n+Math.max(0,g.allowance-g.used),0);
 }
 function grant({id,company,kind='analysis',amount,expires,available=amount,reason='Payment verified'}){
  identifier(id);identifier(company);
  if(!['analysis','joe'].includes(kind)||!Number.isSafeInteger(amount)||amount<1||amount>100000||!Number.isSafeInteger(expires)||expires<=now())fail(400,'Invalid credit grant.');
  if(!Number.isSafeInteger(available)||available<0||available>amount)fail(400,'Invalid available credit amount.');
  identifier(reason);
  return transaction(()=>{
   const old=db.prepare('SELECT * FROM credit_grants WHERE id=?').get(id);
   if(old){if(old.company!==company||old.kind!==kind||old.amount!==amount||old.expires!==expires)fail(409,'Grant identifier already used with different details.');return false;}
   db.prepare('INSERT INTO credit_grants VALUES(?,?,?,?,?)').run(id,company,kind,amount,expires);
   db.prepare('INSERT INTO credit_adjustments VALUES(?,?,?)').run(id,available,reason);return true;
  });
 }
 function reserve(company,requestKey,kind='analysis'){
  identifier(company);identifier(requestKey);
  if(!['analysis','joe'].includes(kind))fail(400,'Invalid credit type.');
  return transaction(()=>{
   if(db.prepare('SELECT 1 FROM credit_requests WHERE company=? AND request_key=?').get(company,requestKey))fail(409,'This request has already been submitted.');
   const bucket=grants(company,kind).find(g=>g.used<g.allowance);
   if(!bucket)fail(429,'No credits are available for this company.');
   db.prepare("INSERT INTO credit_requests VALUES(?,?,?,?,'reserved')").run(company,requestKey,kind,bucket.id);
  });
 }
 function settle(company,requestKey,successful){
  identifier(company);identifier(requestKey);if(typeof successful!=='boolean')fail(400,'A completion result is required.');
  return transaction(()=>{
   const row=db.prepare('SELECT state FROM credit_requests WHERE company=? AND request_key=?').get(company,requestKey);
   if(!row)fail(404,'Credit reservation not found.');
   const state=successful?'completed':'refunded';
   if(row.state===state)return false;
   if(row.state!=='reserved')fail(409,'Credit reservation has already been settled.');
   db.prepare('UPDATE credit_requests SET state=? WHERE company=? AND request_key=?').run(state,company,requestKey);return true;
  });
 }
 // Adjust only unused access; retain the immutable grant and every usage record.
 // Reinstating a disputed payment never restores already-consumed credits.
 function adjust(id,company,available,reason){
  identifier(id);identifier(company);identifier(reason);
  return transaction(()=>{
   const g=db.prepare('SELECT amount FROM credit_grants WHERE id=? AND company=?').get(id,company);
   if(!g)fail(404,'Credit grant not found.');
   if(!Number.isSafeInteger(available)||available<0||available>g.amount)fail(400,'Invalid available credit amount.');
   db.prepare('INSERT INTO credit_adjustments VALUES(?,?,?) ON CONFLICT(grant_id) DO UPDATE SET available=excluded.available,reason=excluded.reason').run(id,available,reason);
  });
 }
 const grantInfo=(id,company)=>db.prepare('SELECT amount,expires,kind FROM credit_grants WHERE id=? AND company=?').get(id,company);
 return {balance,grant,reserve,settle,adjust,grantInfo,close:()=>db.close()};
}

export function billingPreview(){return {mode:'pilot',checkout_enabled:false,currency:'USD',plans:PLANS,trial_analyses:3,
 message:'Your existing pilot access is unchanged. These are proposed launch plans; purchases and monthly allowances are not active yet.',
 joe_message:'Joe will have a separate allowance. Its launch limit is still being evaluated.'};}


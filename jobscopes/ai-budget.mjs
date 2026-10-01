import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
// Standard Astra rates verified 2026-10-01. Cached input is conservatively
// charged at the uncached rate here. This tracks estimated provider spending;
// it is not a replacement for the provider's invoice or prepaid funding limit.
export function astraCostMicros(usage){
 const input=usage?.input_tokens,output=usage?.output_tokens;
 if(!Number.isSafeInteger(input)||input<0||!Number.isSafeInteger(output)||output<0)return null;
 const cost=input*10+output*50;
 return Number.isSafeInteger(cost)?cost:null;
}
export function aiBudget(dataDir,{monthlyUsd=25,now=()=>Date.now()}={}){
 if(!Number.isInteger(monthlyUsd)||monthlyUsd<1||monthlyUsd>10000)throw new Error('Invalid monthly AI budget.');
 const db=new DatabaseSync(join(dataDir,'ai-budget.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS spending(id TEXT PRIMARY KEY,month TEXT NOT NULL,reserved INTEGER NOT NULL,actual INTEGER,status TEXT NOT NULL);`);
 const month=()=>new Date(now()).toISOString().slice(0,7);
 const total=()=>db.prepare('SELECT coalesce(sum(coalesce(actual,reserved)),0) n FROM spending WHERE month=?').get(month()).n;
 function reserve(id){
  if(typeof id!=='string'||!id||id.length>250)fail(400,'Invalid spending request.');
  // Conservative buffer for the bounded photo/chat request, retained on unknown
  // outcomes. Do not automatically retry a request with uncertain provider cost.
  const reserved=3000000;
  db.exec('BEGIN IMMEDIATE');
  try{
   if(db.prepare('SELECT 1 FROM spending WHERE id=?').get(id))fail(409,'This AI request was already submitted.');
   if(total()+reserved>monthlyUsd*1e6)fail(429,'AI usage is temporarily paused at the service spending limit. No analysis credit was used. Please contact support.');
   db.prepare("INSERT INTO spending VALUES(?,?,?,NULL,'reserved')").run(id,month(),reserved);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 function settle(id,usage){
  const actual=astraCostMicros(usage);if(actual===null)return;
  db.exec('BEGIN IMMEDIATE');
  try{
   const row=db.prepare('SELECT actual FROM spending WHERE id=?').get(id);if(!row)fail(404,'Spending reservation missing.');
   if(row.actual!==null&&row.actual!==actual)fail(409,'Spending result already recorded.');
   db.prepare("UPDATE spending SET actual=?,status='reported' WHERE id=?").run(actual,id);db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 function status(){const used=total()/1e6;return {month:month(),limit_usd:monthlyUsd,estimated_used_usd:used,alert:used>=monthlyUsd*.8,paused:used+3>monthlyUsd};}
 return {reserve,settle,status,close:()=>db.close()};
}

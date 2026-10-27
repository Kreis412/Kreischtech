import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

export const FOUNDING_OFFER_LIMIT=100;
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};

// Reserve one saved photo analysis for each of the first 100 distinct new business profiles.
export function foundingOffer(dataDir,{now=()=>Date.now()}={}){
 mkdirSync(dataDir,{recursive:true});
 const db=new DatabaseSync(join(dataDir,'founding-offer.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS founding_offer_claims(
  company TEXT PRIMARY KEY, owner TEXT NOT NULL UNIQUE, reference TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL UNIQUE, state TEXT NOT NULL CHECK(state IN ('reserved','granted')),
  created INTEGER NOT NULL
 );`);
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}}
 async function award({company,owner,reference,grant}){
  if(typeof company!=='string'||!company.trim()||company.length>250)fail(400,'Invalid offer account.');
  if(typeof owner!=='string'||!owner.trim()||owner.length>250)fail(400,'Invalid offer owner.');
  if(typeof reference!=='string'||!reference.trim()||reference.length>250)fail(400,'Invalid offer purchase reference.');
  if(typeof grant!=='function')fail(500,'Offer credit grant is unavailable.');
  const reservation=transaction(()=>{
   const old=db.prepare('SELECT * FROM founding_offer_claims WHERE company=? OR owner=?').get(company,owner);
   if(old){if(old.company!==company||old.owner!==owner||old.reference!==reference)return null;return old;}
   if(db.prepare('SELECT 1 FROM founding_offer_claims WHERE reference=?').get(reference))return null;
   const count=db.prepare('SELECT count(*) n FROM founding_offer_claims').get().n;
   if(count>=FOUNDING_OFFER_LIMIT)return null;
   const position=count+1;
   db.prepare("INSERT INTO founding_offer_claims VALUES(?,?,?,?, 'reserved',?)").run(company,owner,reference,position,now());
   return {company,owner,reference,position,state:'reserved'};
  });
  if(!reservation)return {granted:false,reason:'offer_full'};
  if(reservation.state==='granted')return {granted:true,position:reservation.position,already_granted:true};
  await grant({id:'business-profile:'+createHash('sha256').update(company).digest('hex'),company,kind:'analysis',amount:1,expires:Number.MAX_SAFE_INTEGER,reason:'First 100 business profile bonus'});
  db.prepare("UPDATE founding_offer_claims SET state='granted' WHERE company=? AND owner=? AND reference=?").run(company,owner,reference);
  return {granted:true,position:reservation.position,already_granted:false};
 }
 const status=()=>({limit:FOUNDING_OFFER_LIMIT,claimed:db.prepare('SELECT count(*) n FROM founding_offer_claims WHERE state=\'granted\'').get().n,remaining:Math.max(0,FOUNDING_OFFER_LIMIT-db.prepare('SELECT count(*) n FROM founding_offer_claims').get().n)});
 return {award,status,close:()=>db.close()};
}

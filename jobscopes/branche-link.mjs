import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash} from 'node:crypto';
import {join} from 'node:path';
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function brancheLink(directory,{member,now=()=>Date.now()}={}){
 const db=new DatabaseSync(join(directory,'branche-link.sqlite'));
 db.exec('CREATE TABLE IF NOT EXISTS link_codes(token TEXT PRIMARY KEY,uid TEXT,company TEXT,name TEXT,expires INTEGER); CREATE TABLE IF NOT EXISTS link_limits(id TEXT PRIMARY KEY,count INTEGER,expires INTEGER)');
 return {
  issue(session){
   if(session.role!=='Owner')fail(403,'Only the business owner can connect Branche.');
   db.prepare('DELETE FROM link_codes WHERE uid=? OR expires<=?').run(session.user_id,now());
   const code=randomBytes(32).toString('base64url');
   db.prepare('INSERT INTO link_codes VALUES(?,?,?,?,?)').run(hash(code),session.user_id,session.company_id,session.company_name,now()+600000);
   return {code,expires_in:600,company:session.company_name};
  },
  redeem(code,address){
   db.prepare('DELETE FROM link_limits WHERE expires<=?').run(now());
   const key=hash(String(address));
   const r=db.prepare('INSERT INTO link_limits VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').get(key,now()+60000);
   if(r.count>20)fail(429,'Please wait a minute before trying another code.');
   if(typeof code!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(code))fail(400,'Enter the connection code from ContractorSight.');
   const row=db.prepare('DELETE FROM link_codes WHERE token=? AND expires>? RETURNING *').get(hash(code),now());
   if(!row||!member(row.uid,row.company))fail(400,'This connection code is invalid, expired, or already used.');
   return {user_id:row.uid,company_id:row.company,company_name:row.name};
  },
  close:()=>db.close()
 };
}

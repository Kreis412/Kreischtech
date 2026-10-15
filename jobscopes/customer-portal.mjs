import {DatabaseSync} from 'node:sqlite';
import {randomBytes,createHash} from 'node:crypto';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
const fail=(s,m)=>{throw Object.assign(new Error(m),{status:s});};
const hash=t=>createHash('sha256').update(t).digest('hex');
export function customerPortal(dataDir,{now=()=>Date.now()}={}){
 const db=new DatabaseSync(join(dataDir,'customer-portals.sqlite'));
 db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS portals(company TEXT, project TEXT, token_hash TEXT UNIQUE, expires INTEGER, data TEXT, PRIMARY KEY(company,project))');
 db.exec('CREATE TABLE IF NOT EXISTS portal_messages(id INTEGER PRIMARY KEY,company TEXT,project TEXT,sender TEXT,body TEXT,created INTEGER)');
 db.exec('CREATE TABLE IF NOT EXISTS company_profiles(company TEXT PRIMARY KEY,data TEXT NOT NULL)');
 const profileData=c=>JSON.parse(db.prepare('SELECT data FROM company_profiles WHERE company=?').get(c)?.data||'{"enabled":false,"name":"","description":"","photos":[]}');
 function profile(s,b){
  owner(s);if(b===undefined)return profileData(s.company_id);
  if(typeof b.enabled!=='boolean'||typeof b.name!=='string'||b.name.length>160||typeof b.description!=='string'||b.description.length>1200||(b.enabled&&!b.name.trim()))fail(400,'Enter a business name and a description of up to 1,200 characters.');
  if(!Array.isArray(b.photos)||b.photos.length>6||b.photos.some(p=>!p||typeof p!=='object')||new Set(b.photos.map(p=>p.id)).size!==b.photos.length)fail(400,'Choose up to six different gallery photos.');
  const path=join(dataDir,'companies',s.company_id,'contractoros.sqlite');if(!existsSync(path))fail(400,'Create a project and upload photos first.');
  const w=new DatabaseSync(path,{readOnly:true});try{for(const p of b.photos){if(typeof p.id!=='string'||typeof p.caption!=='string'||p.caption.length>160||!w.prepare('SELECT 1 FROM photos WHERE id=?').get(p.id))fail(400,'Choose photos from your company and captions up to 160 characters.');}}finally{w.close();}
  const data={enabled:b.enabled,name:b.name.trim(),description:b.description.trim(),photos:b.photos.map(p=>({id:p.id,caption:p.caption.trim()}))};
  db.prepare('INSERT INTO company_profiles VALUES(?,?) ON CONFLICT(company) DO UPDATE SET data=excluded.data').run(s.company_id,JSON.stringify(data));return data;
 }
 const messages=(c,p)=>db.prepare('SELECT sender,body,created FROM portal_messages WHERE company=? AND project=? ORDER BY id DESC LIMIT 100').all(c,p).reverse();
 function addMessage(c,p,sender,body){if(typeof body!=='string'||!body.trim()||body.length>2000)fail(400,'Write a message of 1 to 2,000 characters.');if(db.prepare('SELECT count(*) n FROM portal_messages WHERE company=? AND project=? AND created>?').get(c,p,now()-60000).n>=5)fail(429,'Please wait a minute before sending more messages.');db.prepare('INSERT INTO portal_messages(company,project,sender,body,created) VALUES(?,?,?,?,?)').run(c,p,sender,body.trim(),now());return {sent:true};}
 function source(company,project,fn){
  const path=join(dataDir,'companies',company,'contractoros.sqlite');
  if(!existsSync(path))fail(404,'Project not found.');
  const w=new DatabaseSync(path,{readOnly:true});try{if(!w.prepare('SELECT 1 FROM projects WHERE id=?').get(project))fail(404,'Project not found.');return fn(w);}finally{w.close();}
 }
 function owner(s){if(!['Owner','Manager'].includes(s.role))fail(403,'Only owners and managers can publish customer updates.');}
 function status(s,p){owner(s);return source(s.company_id,p,()=>{const row=db.prepare('SELECT expires,data FROM portals WHERE company=? AND project=?').get(s.company_id,p);return row?{active:row.expires>now(),expires:row.expires,...JSON.parse(row.data),messages:messages(s.company_id,p)}:{active:false,messages:messages(s.company_id,p)};});}
 function publish(s,p,b){owner(s);return source(s.company_id,p,w=>{
  const clean=(key,max,required=false)=>{const v=b[key]??'';if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(400,'Check '+key+'.');return v.trim();};
  const title=clean('title',160,true),status=clean('status',80,true),update=clean('update',4000),milestones=clean('milestones',2000),completion=clean('completion',100);
  if(!Number.isInteger(b.progress)||b.progress<0||b.progress>100)fail(400,'Progress must be a whole number from 0 to 100.');
  if(!Array.isArray(b.photos)||b.photos.length>12||new Set(b.photos).size!==b.photos.length)fail(400,'Choose up to 12 photos.');
  for(const id of b.photos)if(typeof id!=='string'||!w.prepare('SELECT 1 FROM photos WHERE id=? AND project_id=?').get(id,p))fail(400,'Choose photos from this project only.');
  const data={title,status,update,milestones,completion,progress:b.progress,photos:b.photos,updated_at:new Date(now()).toISOString()};
  const old=db.prepare('SELECT token_hash,expires FROM portals WHERE company=? AND project=?').get(s.company_id,p);
  const keep=old&&old.expires>now()&&b.replace_link!==true;
  const token=keep?null:randomBytes(32).toString('base64url'),expires=keep?old.expires:now()+90*86400000;
  db.prepare('INSERT INTO portals VALUES(?,?,?,?,?) ON CONFLICT(company,project) DO UPDATE SET token_hash=excluded.token_hash,expires=excluded.expires,data=excluded.data').run(s.company_id,p,keep?old.token_hash:hash(token),expires,JSON.stringify(data));
  return {token,expires,...data};
 });}
 function revoke(s,p){owner(s);source(s.company_id,p,()=>db.prepare('UPDATE portals SET expires=0 WHERE company=? AND project=?').run(s.company_id,p));return {revoked:true};}
 function lookup(token){
  if(typeof token!=='string'||!/^[-_a-zA-Z0-9]{43}$/.test(token))fail(404,'This customer link is unavailable or expired.');
  const r=db.prepare('SELECT * FROM portals WHERE token_hash=? AND expires>?').get(hash(token),now());if(!r)fail(404,'This customer link is unavailable or expired.');
  return r;
 }
 function read(token,photo){
  const r=lookup(token),data=JSON.parse(r.data);
  return source(r.company,r.project,w=>{const profile=profileData(r.company);const company_profile=profile.enabled?{name:profile.name,description:profile.description,photos:profile.photos.filter(p=>w.prepare('SELECT 1 FROM photos WHERE id=?').get(p.id))}:null;if(!photo)return {...data,company_profile,messages:messages(r.company,r.project)};const gallery=company_profile?.photos.some(p=>p.id===photo);if(!data.photos.includes(photo)&&!gallery)fail(404,'Photo not shared.');const image=gallery?w.prepare('SELECT content,mime FROM photos WHERE id=?').get(photo):w.prepare('SELECT content,mime FROM photos WHERE project_id=? AND id=?').get(r.project,photo);if(!image)fail(404,'Photo unavailable.');return image;});
 }
 function customerMessage(token,body){const r=lookup(token);return source(r.company,r.project,()=>addMessage(r.company,r.project,'Customer',body));}
 function contractorMessage(s,p,body){owner(s);return source(s.company_id,p,()=>addMessage(s.company_id,p,'Contractor',body));}
 return {status,publish,revoke,read,profile,customerMessage,contractorMessage,close:()=>db.close()};
}

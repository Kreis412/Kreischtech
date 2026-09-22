import {randomUUID} from 'node:crypto';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const text=(v,max=300)=>typeof v==='string'&&v.trim().length<=max?v.trim():fail(400,'Enter valid text.');
const date=v=>!v?'':typeof v==='string'&&/^20\d\d-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v?v:fail(400,'Enter a valid date.');
const number=v=>v===''||v==null?null:/^\d+(\.\d{1,2})?$/.test(String(v))&&Number(v)<=1e9?Number(v):fail(400,'Enter a nonnegative number with at most two decimal places.');
const choice=(v,a)=>a.includes(v)?v:fail(400,'Choose a valid option.');
export function equipmentStore(db){
 db.exec(`CREATE TABLE IF NOT EXISTS equipment(id TEXT PRIMARY KEY,tag TEXT UNIQUE COLLATE NOCASE,data TEXT NOT NULL,revision INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS equipment_service(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES equipment(id),data TEXT NOT NULL,created_at TEXT NOT NULL);`);
 const unpack=r=>r?{...JSON.parse(r.data),id:r.id,revision:r.revision}:null;
 const get=id=>unpack(db.prepare('SELECT * FROM equipment WHERE id=?').get(id))||fail(404,'Asset not found.');
 return {async handle(req,url,project,json,send){
  const m=url.pathname.match(/^\/api\/equipment(?:\/([\w-]+)(?:\/(service))?)?$/);if(!m)return false;
  const actor=req.jobscopesActor||{role:'Owner',name:'Local operator'},canEdit=['Owner','Manager'].includes(actor.role),id=m[1];
  if(req.method==='GET'&&!id){const today=new Date().toISOString().slice(0,10);const assets=db.prepare('SELECT * FROM equipment ORDER BY tag').all().map(unpack).map(a=>({...a,due:a.status!=='Retired'&&Boolean((a.service_date&&a.service_date<=today)||(a.service_meter!==null&&a.reading!==null&&a.reading>=a.service_meter)),registration_due:a.status!=='Retired'&&Boolean(a.registration_date&&a.registration_date<=today),history:db.prepare('SELECT * FROM equipment_service WHERE asset_id=? ORDER BY created_at DESC').all(a.id).map(r=>{const s={...JSON.parse(r.data),id:r.id};if(!canEdit)delete s.cost;return s;})}));send(200,{assets,canEdit,today});return true;}
  if(!canEdit)fail(403,'Only owners and managers can update equipment.');
  if(m[2]&&req.method==='POST'){
   const a=get(id),b=await json(req);if(Number(b.revision)!==a.revision)fail(409,'Asset changed. Refresh and try again.');
   const s={date:date(b.date),description:text(b.description,2000),provider:text(b.provider||''),cost:number(b.cost),recorded_by:actor.name};if(!s.date||s.date>new Date().toISOString().slice(0,10)||!s.description)fail(400,'Enter completed work and a date no later than today.');
   const sid=randomUUID();db.prepare('INSERT INTO equipment_service VALUES(?,?,?,?)').run(sid,id,JSON.stringify(s),new Date().toISOString());send(201,{...s,id:sid});return true;
  }
  if(!((req.method==='POST'&&!id)||(req.method==='PUT'&&id)))fail(405,'Method not allowed.');
  const b=await json(req),old=id?get(id):null;if(old&&Number(b.revision)!==old.revision)fail(409,'Asset changed. Refresh and try again.');
  const a={};for(const k of ['tag','name','make_model','serial','location','responsible','plate','vin'])a[k]=text(b[k]||'');
  if(!a.tag||!a.name)fail(400,'Asset tag and name are required.');
  a.type=choice(b.type,['Tool','Equipment','Vehicle','Trailer']);a.status=choice(b.status,['Available','Assigned','Out of service','Retired']);a.meter=choice(b.meter,['None','Hours','Miles','Kilometers']);a.reading=number(b.reading);a.service_meter=number(b.service_meter);a.service_date=date(b.service_date);a.registration_date=date(b.registration_date);a.notes=text(b.notes||'',2000);a.project_id=b.project_id||'';
  if(a.project_id)project(a.project_id);
  if(a.project_id&&a.status!=='Assigned')fail(400,'Choose Assigned when assigning an asset to a project.');
  if(a.meter==='None'&&(a.reading!==null||a.service_meter!==null))fail(400,'Choose a meter unit before entering readings.');
  if(old&&old.reading!==null&&(a.meter!==old.meter||a.reading===null||a.reading<old.reading))fail(400,'Recorded meter units cannot change and readings cannot decrease.');
  if(db.prepare('SELECT id FROM equipment WHERE tag=? AND id<>?').get(a.tag,id||''))fail(409,'That asset tag is already in use.');
  const key=id||randomUUID();if(old)db.prepare('UPDATE equipment SET tag=?,data=?,revision=revision+1 WHERE id=?').run(a.tag,JSON.stringify(a),key);else db.prepare('INSERT INTO equipment VALUES(?,?,?,1)').run(key,a.tag,JSON.stringify(a));send(old?200:201,get(key));return true;
 }};
}

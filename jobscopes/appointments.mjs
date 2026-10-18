import {DatabaseSync} from 'node:sqlite';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {join} from 'node:path';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const hash=s=>createHash('sha256').update(s).digest('hex');
const clean=(v,max,required=true)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(400,'Please complete the requested details.');return v.trim();};
export function appointments(dataDir,{now=()=>Date.now()}={}){
 const db=new DatabaseSync(join(dataDir,'appointments.sqlite'));
 db.exec(`PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS booking_settings(company TEXT PRIMARY KEY,token TEXT UNIQUE,settings TEXT); CREATE TABLE IF NOT EXISTS appointment_requests(id TEXT PRIMARY KEY,company TEXT,status TEXT,start INTEGER,end INTEGER,details TEXT,secret TEXT UNIQUE,created INTEGER,revision INTEGER DEFAULT 1); CREATE INDEX IF NOT EXISTS appointment_company ON appointment_requests(company,start);`);
 const manager=s=>{if(!['Owner','Manager'].includes(s.role))fail(403,'Only owners and managers can manage appointments.');};
 const defaults={enabled:false,name:'',timezone:'America/New_York',days:[1,2,3,4,5],open:'09:00',close:'17:00',duration:60,buffer:30};
 function settings(s,b){manager(s);let row=db.prepare('SELECT * FROM booking_settings WHERE company=?').get(s.company_id);
  if(b!==undefined){const name=clean(b.name,160),timezone=clean(b.timezone,80);try{new Intl.DateTimeFormat('en-US',{timeZone:timezone}).format();}catch{fail(400,'Choose a valid time zone.');}
   if(typeof b.enabled!=='boolean'||!Array.isArray(b.days)||!b.days.length||b.days.some(d=>!Number.isInteger(d)||d<0||d>6)||!/^\d{2}:\d{2}$/.test(b.open)||!/^\d{2}:\d{2}$/.test(b.close)||!['open','close'].every(k=>Number(b[k].slice(0,2))<24&&Number(b[k].slice(3))<60)||b.open>=b.close||![30,60,90,120].includes(b.duration)||![0,15,30,60].includes(b.buffer))fail(400,'Check available days, hours and appointment length.');
   const value={enabled:b.enabled,name,timezone,days:[...new Set(b.days)],open:b.open,close:b.close,duration:b.duration,buffer:b.buffer};
   db.prepare('INSERT INTO booking_settings VALUES(?,?,?) ON CONFLICT(company) DO UPDATE SET settings=excluded.settings').run(s.company_id,row?.token||randomBytes(24).toString('base64url'),JSON.stringify(value));row=db.prepare('SELECT * FROM booking_settings WHERE company=?').get(s.company_id);
  }return row?{...JSON.parse(row.settings),token:row.token}:{...defaults,token:null};
 }
 function config(token){if(typeof token!=='string'||token.length!==32)fail(404,'This booking link is unavailable.');const r=db.prepare('SELECT * FROM booking_settings WHERE token=?').get(token);if(!r)fail(404,'This booking link is unavailable.');const c=JSON.parse(r.settings);if(!c.enabled)fail(404,'This business is not accepting appointment requests right now.');return {...c,company:r.company};}
 const local=(ms,tz)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(ms).map(p=>[p.type,p.value]));
 function wallTime(date,time,tz){const target=Date.parse(date+'T'+time+':00Z');let ms=target;for(let n=0;n<4;n++){const p=local(ms,tz),actual=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);if(actual===target)return ms;ms+=target-actual;}return NaN;}
 function available(c,date,exclude=''){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00Z'))||new Date(date+'T00:00Z').toISOString().slice(0,10)!==date)fail(400,'Choose a valid date.');
  if(Math.abs(Date.parse(date+'T12:00Z')-now())>61*86400000)fail(400,'Choose a date within the next 60 days.');
  if(!c.days.includes(new Date(date+'T12:00Z').getUTCDay()))return [];
  const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3)),out=[];
  for(let m=minutes(c.open);m+c.duration<=minutes(c.close);m+=c.duration+c.buffer){const label=String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'),start=wallTime(date,label,c.timezone),end=start+c.duration*60000;
   if(!Number.isFinite(start)||start<now()+3600000||start>now()+60*86400000)continue;
   if(db.prepare("SELECT 1 FROM appointment_requests WHERE company=? AND status='approved' AND id<>? AND start<? AND end>? LIMIT 1").get(c.company,exclude,end+c.buffer*60000,start-c.buffer*60000))continue;
   out.push({start,end,label});
  }return out;
 }
 function publicView(token,date){const c=config(token);return {name:c.name,timezone:c.timezone,duration:c.duration,slots:date?available(c,date):[]};}
 function request(token,b){const c=config(token),details={name:clean(b.name,120),email:clean(b.email,200),phone:clean(b.phone||'',50,false),address:clean(b.address,500),description:clean(b.description,2000)};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email))fail(400,'Enter a valid email address.');
  if(b.website)fail(400,'Unable to submit this request.');
  const key=clean(b.request_key,80);if(!/^[\w-]{16,80}$/.test(key))fail(400,'Reload the booking page and try again.');const secret=hash(token+key);
  const previous=db.prepare('SELECT * FROM appointment_requests WHERE secret=?').get(secret);if(previous)return {status:previous.status,token:secret};
  if(db.prepare('SELECT count(*) n FROM appointment_requests WHERE company=? AND created>?').get(c.company,now()-3600000).n>=30||db.prepare('SELECT count(*) n FROM appointment_requests WHERE company=? AND created>? AND json_extract(details,\'$.email\')=?').get(c.company,now()-86400000,details.email).n>=3)fail(429,'Too many requests. Please contact the contractor directly.');
  const slot=available(c,b.date).find(x=>x.start===b.start);if(!slot)fail(409,'That time is no longer available. Choose another time.');
  db.prepare('INSERT INTO appointment_requests(id,company,status,start,end,details,secret,created) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),c.company,'pending',slot.start,slot.end,JSON.stringify({...details,timezone:c.timezone}),secret,now());return {status:'pending',token:secret};
 }
 function publicStatus(token){if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))fail(404,'Request not found.');const r=db.prepare('SELECT * FROM appointment_requests WHERE secret=?').get(token);if(!r)fail(404,'Request not found.');return {status:r.status,start:r.start,end:r.end,timezone:JSON.parse(r.details).timezone};}
 function list(s){manager(s);return db.prepare('SELECT id,status,start,end,details,revision FROM appointment_requests WHERE company=? ORDER BY start DESC LIMIT 500').all(s.company_id).map(r=>({...r,...JSON.parse(r.details),details:undefined}));}
 function update(s,id,b){manager(s);const r=db.prepare('SELECT * FROM appointment_requests WHERE id=? AND company=?').get(id,s.company_id);if(!r)fail(404,'Appointment not found.');if(b.revision!==r.revision)fail(409,'This appointment changed. Refresh and try again.');if(!['approved','declined','canceled','pending'].includes(b.status))fail(400,'Choose an appointment status.');
  let start=r.start,end=r.end;const c={...settings(s),company:s.company_id};
  if(b.start!==undefined){const slot=available(c,b.date,id).find(x=>x.start===b.start);if(!slot)fail(409,'Choose an available time.');start=slot.start;end=slot.end;}
  if(b.status==='approved'){if(start<=now())fail(400,'Choose a future appointment time.');if(db.prepare("SELECT 1 FROM appointment_requests WHERE company=? AND status='approved' AND id<>? AND start<? AND end>?").get(s.company_id,id,end+c.buffer*60000,start-c.buffer*60000))fail(409,'This conflicts with an approved appointment. Reschedule one first.');}
  const details=JSON.parse(r.details);if(b.start!==undefined)details.timezone=c.timezone;
  db.prepare('UPDATE appointment_requests SET status=?,start=?,end=?,details=?,revision=revision+1 WHERE id=?').run(b.status,start,end,JSON.stringify(details),id);return {saved:true};
 }
 return {settings,publicView,request,publicStatus,list,update,close:()=>db.close()};
}

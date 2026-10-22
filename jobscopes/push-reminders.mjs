import webpush from 'web-push';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function localClock(ms,timezone){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(ms).map(p=>[p.type,p.value]));return {day:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};}
export function validSubscription(value){
 if(!value||typeof value.endpoint!=='string'||value.endpoint.length>2048)fail(400,'Invalid notification subscription.');let url;try{url=new URL(value.endpoint);}catch{fail(400,'Invalid notification address.');}
 const allowed=url.hostname==='fcm.googleapis.com'||url.hostname==='updates.push.services.mozilla.com'||url.hostname==='push.services.mozilla.com'||url.hostname==='web.push.apple.com'||url.hostname.endsWith('.notify.windows.com');
 if(!allowed||url.protocol!=='https:'||url.port||url.username||url.password||url.hash)fail(400,'This notification provider is not supported yet.');
 if(!/^[A-Za-z0-9_-]{87}$/.test(value.keys?.p256dh||'')||!/^[A-Za-z0-9_-]{22}$/.test(value.keys?.auth||''))fail(400,'Invalid notification keys.');
 return {endpoint:value.endpoint,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth}};
}
export function pushReminders(dataDir,{now=Date.now,send=webpush.sendNotification,member=()=>true}={}){
 const db=new DatabaseSync(join(dataDir,'push-reminders.sqlite'));db.exec(`PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS push_keys(id INTEGER PRIMARY KEY,value TEXT);CREATE TABLE IF NOT EXISTS push_reminders(id TEXT PRIMARY KEY,user TEXT,company TEXT,subscription TEXT,time TEXT,timezone TEXT,last_day TEXT,last_test INTEGER DEFAULT 0);`);
 let key=db.prepare('SELECT value FROM push_keys WHERE id=1').get();if(!key){const generated=webpush.generateVAPIDKeys();db.prepare('INSERT OR IGNORE INTO push_keys VALUES(1,?)').run(JSON.stringify(generated));key=db.prepare('SELECT value FROM push_keys WHERE id=1').get();}const vapid=JSON.parse(key.value);
 const hash=e=>createHash('sha256').update(e).digest('hex');let timer,busy=false,closed=false;
 function owned(s,endpoint){const row=db.prepare('SELECT * FROM push_reminders WHERE id=?').get(hash(endpoint));if(row&&(row.user!==s.user_id||row.company!==s.company_id))fail(409,'This device is linked to another account. Turn off notifications there first.');return row;}
 function status(s,endpoint){const row=endpoint?owned(s,endpoint):null;return {public_key:vapid.publicKey,enabled:Boolean(row),time:row?.time||'07:00',timezone:row?.timezone||null};}
 function save(s,b){const sub=validSubscription(b.subscription),time=b.time,timezone=b.timezone;if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)||typeof timezone!=='string'||timezone.length>80)fail(400,'Choose a valid time and time zone.');let local;try{local=localClock(now(),timezone);}catch{fail(400,'Choose a valid time zone.');}const old=owned(s,sub.endpoint);if(!old&&db.prepare('SELECT COUNT(*) AS n FROM push_reminders WHERE user=?').get(s.user_id).n>=5)fail(400,'Turn off reminders on an old device first (five-device limit).');db.prepare('INSERT INTO push_reminders VALUES(?,?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET subscription=excluded.subscription,time=excluded.time,timezone=excluded.timezone').run(hash(sub.endpoint),s.user_id,s.company_id,JSON.stringify(sub),time,timezone,local.time>=time?local.day:'');return status(s,sub.endpoint);}
 function remove(s,endpoint){owned(s,endpoint);db.prepare('DELETE FROM push_reminders WHERE id=? AND user=? AND company=?').run(hash(endpoint),s.user_id,s.company_id);return {enabled:false};}
 async function deliver(row){try{await send(JSON.parse(row.subscription),JSON.stringify({type:'daily-checkin'}),{TTL:3600,urgency:'normal',timeout:10000,vapidDetails:{subject:'mailto:kreischtech@gmail.com',publicKey:vapid.publicKey,privateKey:vapid.privateKey}});return true;}catch(e){if(!closed&&[404,410].includes(e.statusCode))db.prepare('DELETE FROM push_reminders WHERE id=?').run(row.id);return false;}}
 async function test(s,endpoint){const row=owned(s,endpoint);if(!row)fail(400,'Enable reminders on this device first.');if(row.last_test>now()-60000)fail(429,'Wait a minute before sending another test.');db.prepare('UPDATE push_reminders SET last_test=? WHERE id=?').run(now(),row.id);if(!await deliver(row))fail(503,'Test notification could not be delivered. Check permissions and enable reminders again.');return {sent:true};}
 async function tick(){if(busy||closed)return;busy=true;try{for(const row of db.prepare('SELECT * FROM push_reminders').all()){if(closed)break;if(!member(row.user,row.company)){db.prepare('DELETE FROM push_reminders WHERE id=?').run(row.id);continue;}const local=localClock(now(),row.timezone),[h,m]=local.time.split(':').map(Number),[th,tm]=row.time.split(':').map(Number),late=h*60+m-th*60-tm;if(row.last_day===local.day||late<0||late>60)continue;
 // Reserve before sending so restarts/ambiguous delivery cannot send duplicate reminders.
 const claimed=db.prepare('UPDATE push_reminders SET last_day=? WHERE id=? AND last_day<>?').run(local.day,row.id,local.day);if(claimed.changes)await deliver(row);
 }}finally{busy=false;}}
 return {status,save,remove,test,tick,start(){timer=setInterval(()=>tick().catch(()=>{}),60000);timer.unref();},close(){closed=true;clearInterval(timer);db.close();}};
}

import {randomUUID,randomBytes,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
export const categories=['Carpentry','Roofing','Plumbing','Electrical','HVAC','Landscaping','Handyman','Cleaning','Painting','Concrete & masonry','General contracting'];
export const termsVersion='2026-11-10-test';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const text=(v,max=200,required=true)=>{if(typeof v!=='string'||v.trim().length>max||(required&&!v.trim()))fail(400,'Please complete the required fields within their length limits.');return v.trim();};
const hash=v=>createHash('sha256').update(v).digest('hex');
const category=v=>categories.includes(v)?v:fail(400,'Choose a service category.');
const safeUser=u=>u?{id:u.id,name:u.name,role:u.role}:null;
export async function openStore({directory='data',databaseUrl=process.env.DATABASE_URL}={}){
 let query,close;
 if(databaseUrl){const {Pool}=await import('pg');const pool=new Pool({connectionString:databaseUrl,max:3});query=async(sql,params=[])=>{let i=0;return (await pool.query(sql.replace(/\?/g,()=>'$'+(++i)),params)).rows;};close=()=>pool.end();}
 else {if(process.env.VERCEL)fail(503,'The shared test database is not connected yet. Please use the local test for now.');const {DatabaseSync}=await import('node:sqlite');mkdirSync(directory,{recursive:true});const db=new DatabaseSync(join(directory,'branche.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');query=async(sql,params=[])=>db.prepare(sql).all(...params);close=()=>db.close();}
 const schemas=[
 'CREATE TABLE IF NOT EXISTS branche_workspaces(uid TEXT PRIMARY KEY,company TEXT UNIQUE NOT NULL,owner TEXT NOT NULL,name TEXT NOT NULL,created BIGINT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS branche_users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,salt TEXT NOT NULL,secret TEXT NOT NULL,terms TEXT NOT NULL,created BIGINT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS branche_sessions(token TEXT PRIMARY KEY,uid TEXT NOT NULL,expires BIGINT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS branche_profiles(uid TEXT PRIMARY KEY,name TEXT NOT NULL,contact TEXT NOT NULL,category TEXT NOT NULL,city TEXT NOT NULL,region TEXT NOT NULL,description TEXT NOT NULL,services TEXT NOT NULL,license TEXT NOT NULL,issuer TEXT NOT NULL,insurance TEXT NOT NULL,published INTEGER NOT NULL,updated BIGINT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS branche_jobs(id TEXT PRIMARY KEY,uid TEXT NOT NULL,title TEXT NOT NULL,category TEXT NOT NULL,city TEXT NOT NULL,description TEXT NOT NULL,timing TEXT NOT NULL,budget TEXT NOT NULL,state TEXT NOT NULL,created BIGINT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS branche_threads(id TEXT PRIMARY KEY,customer TEXT NOT NULL,contractor TEXT NOT NULL,job TEXT NOT NULL,created BIGINT NOT NULL,UNIQUE(customer,contractor,job))',
 'CREATE TABLE IF NOT EXISTS branche_messages(id TEXT PRIMARY KEY,thread TEXT NOT NULL,uid TEXT NOT NULL,body TEXT NOT NULL,created BIGINT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS branche_blocks(uid TEXT NOT NULL,target TEXT NOT NULL,PRIMARY KEY(uid,target))',
 'CREATE TABLE IF NOT EXISTS branche_reports(id TEXT PRIMARY KEY,uid TEXT NOT NULL,target TEXT NOT NULL,kind TEXT NOT NULL,reason TEXT NOT NULL,created BIGINT NOT NULL,state TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS branche_limits(id TEXT PRIMARY KEY,count INTEGER NOT NULL,expires BIGINT NOT NULL)'];
 for(const schema of schemas)await query(schema);
 return {query,close};
}
export function createHandler(store,{now=()=>Date.now(),workspaceRequest=fetch}={}){
 const q=store.query;
 async function limit(key,max,ms){const id=key+':'+Math.floor(now()/ms);const [r]=await q('INSERT INTO branche_limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=branche_limits.count+1 RETURNING count',[id,now()+ms]);if(Number(r.count)>max)fail(429,'Please slow down and try again later.');}
 async function session(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('branche_session='))?.slice(16);if(!token)return null;return (await q('SELECT u.id,u.name,u.role,u.email FROM branche_users u JOIN branche_sessions s ON s.uid=u.id WHERE s.token=? AND s.expires>?',[hash(token),now()]))[0]||null;}
 async function blocked(a,b){return (await q('SELECT uid FROM branche_blocks WHERE (uid=? AND target=?) OR (uid=? AND target=?)',[a,b,b,a])).length>0;}
 async function json(req){if(req.body!==undefined){let b=req.body;try{if(typeof b==='string'||Buffer.isBuffer(b))b=JSON.parse(b.toString());if(!b||Array.isArray(b)||typeof b!=='object')fail(400,'Invalid request.');if(Buffer.byteLength(JSON.stringify(b))>16000)fail(413,'This request is too large.');return b;}catch(e){if(e.status)throw e;fail(400,'Invalid request.');}}let size=0,parts=[];for await(const c of req){size+=c.length;if(size>16000)fail(413,'This request is too large.');parts.push(c);}try{const b=JSON.parse(Buffer.concat(parts));if(!b||Array.isArray(b)||typeof b!=='object')throw Error();return b;}catch{fail(400,'Invalid request.');}}
 return async(req,res)=>{
 const send=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 try{
 const url=new URL(req.url,'http://localhost'),path=url.searchParams.has('path')?'/api/branche/'+url.searchParams.get('path'):url.pathname;
 if(!path.startsWith('/api/branche/'))return send(404,{error:'Not found.'});
 if(!['GET','POST','PUT','DELETE'].includes(req.method))fail(405,'Method not allowed.');
 const write=req.method!=='GET';
 if(write){const origin=req.headers.origin;let expected='http://'+req.headers.host;if(process.env.VERCEL)expected='https://'+req.headers.host;if(origin!==expected)fail(403,'Please use this site to submit changes.');if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'Expected JSON.');}
 const u=await session(req),body=write?await json(req):{};
 if(path==='/api/branche/session'&&!write)return send(200,{user:safeUser(u),categories,termsVersion,test:true});
 if(['/api/branche/register','/api/branche/login'].includes(path)&&req.method==='POST'){
 await limit('auth:'+(req.socket?.remoteAddress||'shared'),20,900000);
 const email=text(body.email,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter a valid email.');
 const pass=text(body.password,200);if(pass.length<12)fail(400,'Use a password of at least 12 characters.');let user;
 if(path.endsWith('register')){if(body.terms!==termsVersion)fail(400,'Please accept the community test terms and safety notice.');if(!['customer','contractor'].includes(body.role))fail(400,'Choose customer or contractor.');const salt=randomBytes(16).toString('hex'),secret=scryptSync(pass,salt,32).toString('hex');user={id:randomUUID(),name:text(body.name,100),role:body.role};try{await q('INSERT INTO branche_users VALUES(?,?,?,?,?,?,?,?)',[user.id,email,user.name,user.role,salt,secret,termsVersion,now()]);}catch(e){if(/unique|constraint/i.test(e.message))fail(409,'That account already exists. Please sign in.');throw e;}}
 else{user=(await q('SELECT * FROM branche_users WHERE email=?',[email]))[0];const candidate=scryptSync(pass,user?.salt||'missing-user',32);if(!timingSafeEqual(candidate,Buffer.from(user?.secret||'00'.repeat(32),'hex')))fail(401,'Email or password is incorrect.');}
 const token=randomBytes(32).toString('hex');await q('INSERT INTO branche_sessions VALUES(?,?,?)',[hash(token),user.id,now()+86400000]);res.setHeader('Set-Cookie',`branche_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.VERCEL?'; Secure':''}`);return send(200,{user:safeUser(user)});
 }
 if(path==='/api/branche/profiles'&&!write){const rows=await q('SELECT uid,name,contact,category,city,region,description,services,license,issuer,insurance FROM branche_profiles WHERE published=1 ORDER BY updated DESC LIMIT 200');return send(200,{profiles:rows});}
 if(path==='/api/branche/jobs'&&!write){const rows=await q("SELECT j.id,j.uid,j.title,j.category,j.city,j.description,j.timing,j.budget,j.state,j.created,u.name FROM branche_jobs j JOIN branche_users u ON u.id=j.uid WHERE j.state='open' ORDER BY j.created DESC LIMIT 200");return send(200,{jobs:rows.map(r=>({...r,name:r.name.split(' ')[0]}))});}
 if(!u)fail(401,'Please sign in to continue.');
 if(write)await limit('write:'+u.id,40,60000);
 if(path==='/api/branche/workspace'){
 if(u.role!=='contractor')fail(403,'A contractor account is required to connect a workspace.');
 const workspaceUrl='https://contractorsight-pilot.onrender.com/';
 if(!write)return send(200,{workspace:(await q('SELECT name,created FROM branche_workspaces WHERE uid=?',[u.id]))[0]||null,url:workspaceUrl});
 if(req.method==='DELETE'){await q('DELETE FROM branche_workspaces WHERE uid=?',[u.id]);return send(200,{saved:true});}
 if(req.method!=='POST')fail(405,'Method not allowed.');
 if((await q('SELECT uid FROM branche_workspaces WHERE uid=?',[u.id])).length)fail(409,'Disconnect the current workspace before connecting a different one.');
 await limit('link:'+u.id,5,600000);const code=text(body.code,100);
 let response;try{response=await workspaceRequest(workspaceUrl+'api/branche/redeem',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({code}),signal:AbortSignal.timeout(12000)});}catch{fail(503,'Could not reach ContractorSight. Your account and subscription have not changed.');}
 let linked;try{linked=await response.json();}catch{fail(503,'Workspace connection is not available on ContractorSight yet.');}
 if(!response.ok)fail(response.status===400?400:503,response.status===400?'The connection code is invalid, expired or already used. Create another code in ContractorSight.':'ContractorSight could not complete the connection. Please try again later.');
 for(const k of ['user_id','company_id','company_name'])if(typeof linked[k]!=='string'||!linked[k]||linked[k].length>200)fail(502,'ContractorSight returned an invalid connection.');
 try{await q('INSERT INTO branche_workspaces VALUES(?,?,?,?,?)',[u.id,linked.company_id,linked.user_id,linked.company_name,now()]);}catch(e){if(/unique|constraint/i.test(e.message))fail(409,'This workspace is already connected to a Branche account.');throw e;}
 return send(200,{saved:true,name:linked.company_name});
 }
 if(path==='/api/branche/logout'&&req.method==='POST'){await q('DELETE FROM branche_sessions WHERE uid=?',[u.id]);res.setHeader('Set-Cookie','branche_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(200,{saved:true});}
 if(path==='/api/branche/profile'){
 if(u.role!=='contractor')fail(403,'Business pages are for contractor accounts.');
 if(!write)return send(200,{profile:(await q('SELECT * FROM branche_profiles WHERE uid=?',[u.id]))[0]||null});
 if(req.method!=='PUT')fail(405,'Method not allowed.');
 const p={name:text(body.name,120),contact:text(body.contact,100),category:category(body.category),city:text(body.city,80),region:text(body.region,200),description:text(body.description,1600),services:text(body.services,700),license:text(body.license||'',100,false),issuer:text(body.issuer||'',120,false),insurance:text(body.insurance||'',150,false)};
 await q('INSERT INTO branche_profiles VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET name=excluded.name,contact=excluded.contact,category=excluded.category,city=excluded.city,region=excluded.region,description=excluded.description,services=excluded.services,license=excluded.license,issuer=excluded.issuer,insurance=excluded.insurance,published=excluded.published,updated=excluded.updated',[u.id,...Object.values(p),body.published===true?1:0,now()]);return send(200,{saved:true});
 }
 if(path==='/api/branche/jobs'&&req.method==='POST'){await limit('jobs:'+u.id,5,86400000);const id=randomUUID();await q('INSERT INTO branche_jobs VALUES(?,?,?,?,?,?,?,?,?,?)',[id,u.id,text(body.title,120),category(body.category),text(body.city,80),text(body.description,2500),text(body.timing,80),text(body.budget||'Discuss with contractor',80),'open',now()]);return send(201,{id});}
 if(path==='/api/branche/my-jobs'&&!write)return send(200,{jobs:await q('SELECT * FROM branche_jobs WHERE uid=? ORDER BY created DESC',[u.id])});
 if(path==='/api/branche/job-state'&&req.method==='PUT'){if(!['closed','open'].includes(body.state))fail(400,'Choose open or closed.');const rows=await q('UPDATE branche_jobs SET state=? WHERE id=? AND uid=? RETURNING id',[body.state,body.id,u.id]);if(!rows.length)fail(404,'Your job was not found.');return send(200,{saved:true});}
 if(path==='/api/branche/threads'){
 if(!write){const rows=await q('SELECT t.*,a.name customer_name,b.name contractor_name FROM branche_threads t JOIN branche_users a ON a.id=t.customer JOIN branche_users b ON b.id=t.contractor WHERE customer=? OR contractor=? ORDER BY created DESC LIMIT 100',[u.id,u.id]);return send(200,{threads:rows});}
 let customer,contractor,job='';
 if(body.job){const j=(await q("SELECT * FROM branche_jobs WHERE id=? AND state='open'",[body.job]))[0];if(!j)fail(404,'This job is no longer open.');if(u.role!=='contractor'||j.uid===u.id)fail(403,'Only another contractor can respond to this job.');const p=(await q('SELECT uid FROM branche_profiles WHERE uid=? AND published=1',[u.id]))[0];if(!p)fail(400,'Publish your free business page before replying.');customer=j.uid;contractor=u.id;job=j.id;}
 else{const p=(await q('SELECT uid FROM branche_profiles WHERE uid=? AND published=1',[body.contractor]))[0];if(!p||p.uid===u.id)fail(400,'Choose another business.');customer=u.id;contractor=p.uid;}
 if(await blocked(customer,contractor))fail(403,'This conversation is unavailable.');const message=text(body.message,2000);await limit('threads:'+u.id,15,86400000);let thread=(await q('SELECT id FROM branche_threads WHERE customer=? AND contractor=? AND job=?',[customer,contractor,job]))[0];if(!thread){const id=randomUUID();await q('INSERT INTO branche_threads VALUES(?,?,?,?,?) ON CONFLICT(customer,contractor,job) DO NOTHING',[id,customer,contractor,job,now()]);thread=(await q('SELECT id FROM branche_threads WHERE customer=? AND contractor=? AND job=?',[customer,contractor,job]))[0];}await q('INSERT INTO branche_messages VALUES(?,?,?,?,?)',[randomUUID(),thread.id,u.id,message,now()]);return send(201,{id:thread.id});
 }
 if(path==='/api/branche/messages'){
 const tid=write?body.thread:url.searchParams.get('thread'),t=(await q('SELECT * FROM branche_threads WHERE id=? AND (customer=? OR contractor=?)',[tid,u.id,u.id]))[0];if(!t)fail(404,'Conversation not found.');const other=t.customer===u.id?t.contractor:t.customer;
 if(!write)return send(200,{blocked:await blocked(u.id,other),other,messages:await q('SELECT id,uid,body,created FROM branche_messages WHERE thread=? ORDER BY created ASC LIMIT 500',[tid])});
 if(await blocked(u.id,other))fail(403,'This conversation has been blocked.');await q('INSERT INTO branche_messages VALUES(?,?,?,?,?)',[randomUUID(),tid,u.id,text(body.message,2000),now()]);return send(201,{sent:true});
 }
 if(path==='/api/branche/block'&&req.method==='POST'){if(body.target===u.id||!(await q('SELECT id FROM branche_users WHERE id=?',[body.target])).length)fail(400,'Invalid account.');await q('INSERT INTO branche_blocks VALUES(?,?) ON CONFLICT(uid,target) DO NOTHING',[u.id,body.target]);return send(200,{blocked:true});}
 if(path==='/api/branche/report'&&req.method==='POST'){if(!['job','profile','conversation'].includes(body.kind))fail(400,'Invalid report.');let target;if(body.kind==='job')target=await q('SELECT id FROM branche_jobs WHERE id=?',[body.target]);else if(body.kind==='profile')target=await q('SELECT uid FROM branche_profiles WHERE uid=?',[body.target]);else target=await q('SELECT id FROM branche_threads WHERE id=? AND (customer=? OR contractor=?)',[body.target,u.id,u.id]);if(!target.length)fail(404,'Item not found.');await limit('reports:'+u.id,10,86400000);await q('INSERT INTO branche_reports VALUES(?,?,?,?,?,?,?)',[randomUUID(),u.id,body.target,body.kind,text(body.reason,1000),now(),'pending']);return send(201,{saved:true,message:'Report saved for review. This private test is not monitored around the clock. For immediate danger, contact emergency services.'});}
 fail(404,'Not found.');
 }catch(e){if(!e.status)console.error('Branche request failed:',e.code||e.name);send(e.status||500,{error:e.status?e.message:'Could not complete this request. Please try again.'});}
 };
}


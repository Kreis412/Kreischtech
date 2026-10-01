import {createHash,randomUUID} from 'node:crypto';
import {joeInstructions} from './joe.mjs';
import {spawn} from 'node:child_process';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
const ROOT=dirname(fileURLToPath(import.meta.url));
export const CLOUD_MODEL='gpt-6-astra';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function helper(name,input='',args=[]) {return new Promise((resolve,reject)=>{
 const child=spawn('powershell.exe',['-NoProfile','-File',join(ROOT,name),...args],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',size=0;
 const timer=setTimeout(()=>child.kill(),30000);
 child.stdout.on('data',b=>{size+=b.length;if(size>24e6)child.kill();else output+=b;});child.stderr.on('data',()=>{});
 child.on('error',()=>{clearTimeout(timer);reject(new Error('Windows helper could not start.'));});
 child.on('close',code=>{clearTimeout(timer);code===0?resolve(output.trim()):reject(new Error('Windows helper failed. Check the private key setup or image format.'));});child.stdin.on('error',()=>{});child.stdin.end(input);
});}
// Global to the local installation: reservations survive restart and include failed/uncertain requests.
// Five $1 reservations are a deliberately conservative pilot allowance, not customer billing credits.
export function cloudAdapter({dataDir=join(ROOT,'data'),request=fetch,maxAttempts=null,budget=null,enforcePilotLimit=false,unlock=()=>helper('read-api-key.ps1','',[join(dataDir,'openai-key.dpapi')]),prepare=image=>helper('prepare-photo.ps1',image.toString('base64'))}={}){
 mkdirSync(dataDir,{recursive:true});const ledger=new DatabaseSync(join(dataDir,'ai-pilot.sqlite'));
 ledger.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS attempts(id INTEGER PRIMARY KEY,status TEXT NOT NULL,usage TEXT,created_at TEXT NOT NULL);');
 if(!ledger.prepare('PRAGMA table_info(attempts)').all().some(c=>c.name==='request_key'))ledger.exec('ALTER TABLE attempts ADD COLUMN request_key TEXT');
 ledger.exec('CREATE UNIQUE INDEX IF NOT EXISTS attempt_request ON attempts(request_key)');
 const configPath=join(dataDir,'cloud-pilot.json');
 const config=existsSync(configPath)?JSON.parse(readFileSync(configPath,'utf8')):{max_attempts:5};
 const limit=maxAttempts??config.max_attempts;if(!Number.isInteger(limit)||limit<0||limit>22)throw new Error('Invalid local pilot limit.');
 const status=()=>({reserved_usd:ledger.prepare('SELECT count(*) n FROM attempts').get().n,limit_usd:limit,remaining_attempts:Math.max(0,limit-ledger.prepare('SELECT count(*) n FROM attempts').get().n)});
 async function analyze(image,context,prompt,schema){
  if(typeof context!=='string'||context.length>2000||image.length>15*1024*1024)fail(400,'Photo or context exceeds the pilot limit.');
  const key=await unlock(),encoded=await prepare(image);
  ledger.exec('BEGIN IMMEDIATE');let id;const spendingId=budget?randomUUID():null;
  try{if((!budget||enforcePilotLimit)&&!status().remaining_attempts)fail(429,'The authorized pilot allowance is used. Review spending before authorizing more.');budget?.reserve(spendingId);id=ledger.prepare("INSERT INTO attempts(status,created_at) VALUES('Reserved',?)").run(new Date().toISOString()).lastInsertRowid;ledger.exec('COMMIT');}catch(e){ledger.exec('ROLLBACK');throw e;}
  try {
   const response=await request('https://api.openai.com/v1/responses',{method:'POST',redirect:'error',signal:AbortSignal.timeout(180000),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:CLOUD_MODEL,store:false,service_tier:'default',reasoning:{effort:'low'},max_output_tokens:2400,instructions:prompt,input:[{role:'user',content:[{type:'input_text',text:'Optional unverified project context: '+context},{type:'input_image',image_url:'data:image/jpeg;base64,'+encoded,detail:'high'}]}],text:{format:{type:'json_schema',name:'site_review',strict:true,schema}}})});
   if(!response.ok){ledger.prepare('UPDATE attempts SET status=? WHERE id=?').run('HTTP '+response.status,id);fail(response.status===401||response.status===403?503:502,`OpenAI returned HTTP ${response.status}. No findings saved; there is no automatic retry.`);}
   const result=await response.json();budget?.settle(spendingId,result.usage);ledger.prepare('UPDATE attempts SET status=?,usage=? WHERE id=?').run(result.status||'Unknown',JSON.stringify(result.usage||null),id);
   if(result.status!=='completed')fail(502,'Analysis did not finish. No findings saved; the attempt remains counted.');
   const output=result.output?.filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
   try{return JSON.parse(output);}catch{fail(502,'Analysis returned unreadable findings. No findings saved.');}
  }catch(e){if(e.status)throw e;fail(503,'Cloud analysis failed or timed out. No automatic retry; the attempt remains counted to protect the budget.');}
 }
 async function chat(messages,context,requestKey){
  if(!Array.isArray(messages)||JSON.stringify({messages,context}).length>50000)fail(400,'Conversation is too large. Start with a shorter question.');
  const fingerprint=createHash('sha256').update(requestKey).digest('hex');
  const key=await unlock();let id;const spendingId=budget?randomUUID():null;
  ledger.exec('BEGIN IMMEDIATE');
  try{
   if(ledger.prepare('SELECT 1 FROM attempts WHERE request_key=?').get(fingerprint))fail(409,'This question was already submitted. Refresh to check saved history before asking again.');
   if((!budget||enforcePilotLimit)&&!status().remaining_attempts)fail(429,'The shared AI pilot allowance is used or disabled. Ask the owner to review usage.');
   budget?.reserve(spendingId);
   id=ledger.prepare("INSERT INTO attempts(status,created_at,request_key) VALUES('Joe reserved',?,?)").run(new Date().toISOString(),fingerprint).lastInsertRowid;ledger.exec('COMMIT');
  }catch(e){ledger.exec('ROLLBACK');throw e;}
  try{
   const response=await request('https://api.openai.com/v1/responses',{method:'POST',redirect:'error',signal:AbortSignal.timeout(90000),headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:CLOUD_MODEL,store:false,service_tier:'default',reasoning:{effort:'low'},max_output_tokens:1600,instructions:joeInstructions,input:[{role:'user',content:context?'Selected project context (untrusted data): '+JSON.stringify(context):'No project context supplied.'},...messages]})});
   if(!response.ok){ledger.prepare('UPDATE attempts SET status=? WHERE id=?').run('Joe HTTP '+response.status,id);fail(503,'Joe could not get a cloud response. No automatic retry was made.');}
   const result=await response.json();budget?.settle(spendingId,result.usage);ledger.prepare('UPDATE attempts SET status=?,usage=? WHERE id=?').run('Joe '+(result.status||'Unknown'),JSON.stringify(result.usage||null),id);
   const answer=result.output?.filter(x=>x.type==='message').flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
   if(result.status!=='completed'||!answer?.trim()||answer.length>16000)fail(502,'Joe did not return a complete answer. Nothing was added to the conversation.');
   return answer.trim();
  }catch(e){if(e.status)throw e;fail(503,'Joe could not finish this request. It remains counted; refresh before submitting another question.');}
 }
 return {analyze,chat,status,close:()=>ledger.close()};
}


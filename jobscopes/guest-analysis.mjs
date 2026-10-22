import {createHash,createHmac,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {REVIEW_PROMPT,schema,validateResult} from './analysis.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const COOKIE='cs_demo';
const MAX_IMAGE_BYTES=5*1024*1024;
const MONTHLY_TRIALS=5;

function cookieValue(req){
 const part=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
 return part?.slice(COOKIE.length+1)||'';
}

export function guestAnalysis(dataDir,{cloud,now=()=>Date.now()}={}){
 const db=new DatabaseSync(join(dataDir,'guest-photo-trials.sqlite'));
 db.exec(`PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS trials(session_hash TEXT PRIMARY KEY,month TEXT NOT NULL,created_at TEXT NOT NULL,used_at TEXT);
 CREATE INDEX IF NOT EXISTS guest_trials_month ON trials(month);`);
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const tokenFor=req=>{
  let token=cookieValue(req);
  if(!/^[A-Za-z0-9_-]{40,60}$/.test(token))token=randomBytes(32).toString('base64url');
  const digest=hash(token);
  db.prepare("DELETE FROM trials WHERE used_at IS NULL AND created_at<?").run(new Date(now()-30*86400000).toISOString());
  db.prepare('INSERT OR IGNORE INTO trials(session_hash,month,created_at) VALUES(?,?,?)').run(digest,new Date(now()).toISOString().slice(0,7),new Date(now()).toISOString());
  return {token,digest};
 };
 const cookie=(token,secure)=>`${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=31536000${secure?'; Secure':''}`;
 function status(req){
  const session=tokenFor(req),row=db.prepare('SELECT used_at FROM trials WHERE session_hash=?').get(session.digest);
  const month=new Date(now()).toISOString().slice(0,7);
  const count=db.prepare('SELECT count(*) n FROM trials WHERE month=? AND used_at IS NOT NULL').get(month).n;
  const cloudReady=Boolean(cloud?.status&&cloud.status().remaining_attempts>0&&!cloud.status().paused);
  return {cookie:session.token,used:Boolean(row.used_at),available:cloudReady&&!row.used_at&&count<MONTHLY_TRIALS,monthly_limit_reached:count>=MONTHLY_TRIALS,remaining_this_month:Math.max(0,MONTHLY_TRIALS-count)};
 }
 async function analyze(req,b){
  if(b?.cloud_consent!==true)fail(400,'Please confirm that you want to send this photo to OpenAI.');
  if(!cloud)fail(503,'Photo preview is temporarily unavailable. Please try again later.');
  const state=status(req);
  if(!state.available)fail(state.used||state.monthly_limit_reached?429:503,state.used?'Your one free photo review has been used on this browser. Create an account to keep using ContractorSight.':state.monthly_limit_reached?'This month’s free photo previews have been used. Please try again next month.':'Free photo previews are temporarily unavailable. Please try again later.');
  if(typeof b.photo!=='string'||!b.photo.startsWith('data:image/jpeg;base64,'))fail(400,'Choose a JPG photo to analyze.');
  const encoded=b.photo.slice('data:image/jpeg;base64,'.length);
  if(!encoded||encoded.length>Math.ceil(MAX_IMAGE_BYTES*4/3)||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))fail(413,'Choose a photo under 5 MB.');
  const image=Buffer.from(encoded,'base64');
  if(!image.length||image.length>MAX_IMAGE_BYTES)fail(413,'Choose a photo under 5 MB.');
  const context=typeof b.description==='string'?b.description.trim():'';
  if(context.length>800)fail(400,'Keep the job description under 800 characters.');
  const {digest}=tokenFor(req),month=new Date(now()).toISOString().slice(0,7),createdAt=new Date(now()).toISOString();
  db.exec('BEGIN IMMEDIATE');
  try{
   const row=db.prepare('SELECT used_at FROM trials WHERE session_hash=?').get(digest);
   if(row?.used_at)fail(429,'Your one free photo review has been used on this browser. Create an account to keep using ContractorSight.');
   const count=db.prepare('SELECT count(*) n FROM trials WHERE month=? AND used_at IS NOT NULL').get(month).n;
   if(count>=MONTHLY_TRIALS)fail(429,'This month’s free photo previews have been used. Please try again next month.');
   db.prepare('UPDATE trials SET month=?,used_at=? WHERE session_hash=? AND used_at IS NULL').run(month,createdAt,digest);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  const prompt=REVIEW_PROMPT+' This is a single free guest preview. Give a concise, useful draft based only on the photo and description. State the likely work in plain language, accept the user-provided description as planning context, and provide up to three practical observations. Do not save or imply that anything is saved. Do not invent a dollar estimate, quantities, hidden conditions, or certainty.';
  const result=validateResult(await cloud.analyze(image,'Guest-provided job description (planning context): '+(context||'Not provided. Ask what work is intended if needed.'),prompt,schema));
  return {summary:result.summary,findings:result.findings,used:true};
 }
 return {status,analyze,close:()=>db.close()};
}

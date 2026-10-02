import {stripeBilling} from './stripe-billing.mjs';
import {aiBudget} from './ai-budget.mjs';
import {runUnmetered} from './paid-usage.mjs';
import { prepareHostedPhoto } from './hosted-photo.mjs';
import { cloudAdapter, CLOUD_MODEL } from './cloud-analysis.mjs';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { mkdirSync,readFileSync } from 'node:fs';
import { dirname,join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { accounts } from './accounts.mjs';
import { createApp } from './workspace.mjs';
import { accessPolicy, isPublicEntryNavigation } from './access.mjs';
const ROOT=dirname(fileURLToPath(import.meta.url));
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
async function json(req) {
  if(!req.headers['content-type']?.startsWith('application/json')) fail(415,'Expected JSON.');
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>65536) fail(413,'Request too large.');chunks.push(chunk);}
  try{const b=JSON.parse(Buffer.concat(chunks));if(!b || typeof b!=='object' || Array.isArray(b)) fail(400,'Expected an object.');return b;}
  catch(e){if(e.status)throw e;fail(400,'Invalid JSON.');}
}
export function createProduct({dataDir=process.env.DATA_DIR||join(ROOT,'data'),publicOrigin='',registrationCode='',billingOptions={},cloudRequest=fetch}={}) {
  mkdirSync(dataDir,{recursive:true});const policy=accessPolicy(publicOrigin);let billing;
  const auth=accounts(dataDir,{secureCookies:policy.hosted,registrationCode:policy.hosted?registrationCode:null,seatLimit:company=>billing?.hasPaidCompany(company)?1:Infinity}),workspaces=new Map();
  const live=process.env.STRIPE_LIVE_BILLING==='1';
  billing=stripeBilling({dataDir,origin:publicOrigin,secretKey:process.env.STRIPE_SECRET_KEY,webhookSecret:process.env.STRIPE_WEBHOOK_SECRET,enabled:live||process.env.STRIPE_TEST_BILLING==='1',mode:live?'live':'test',...(live?{prices:{solo:process.env.STRIPE_SOLO_PRICE_ID}}:{}),...billingOptions,memberCount:auth.memberCount});
  const budget=billing.live&&policy.hosted&&process.env.OPENAI_API_KEY?aiBudget(dataDir,{monthlyUsd:25}):null;
  const cloud=policy.hosted?(process.env.OPENAI_API_KEY?cloudAdapter({dataDir,request:cloudRequest,unlock:async()=>process.env.OPENAI_API_KEY,prepare:prepareHostedPhoto,maxAttempts:Number(process.env.AI_PILOT_MAX_ATTEMPTS||0),budget,enforcePilotLimit:true}):null):(existsSync(join(dataDir,'openai-key.dpapi'))?cloudAdapter({dataDir}):null);
  const paidCloud=budget?cloudAdapter({dataDir:join(dataDir,'paid-ai'),request:cloudRequest,unlock:async()=>process.env.OPENAI_API_KEY,prepare:prepareHostedPhoto,maxAttempts:0,budget}):null;
  function companyCloud(company){
   if(!cloud)return null;
   const chosen=()=>billing.hasPaidCompany(company)?paidCloud:cloud;
   const requireCloud=()=>chosen()||fail(503,'Paid AI is not configured. Contact support.');
   return {status:()=>billing.hasPaidCompany(company)?{mode:'paid',remaining_attempts:budget?.status().paused?0:billing.balance(company),analysis_balance:billing.balance(company),joe_balance:billing.balance(company,'joe'),paused:budget?.status().paused??true}:cloud.status(),
    analyze:(...args)=>requireCloud().analyze(...args),chat:(...args)=>requireCloud().chat(...args),
    runSaved:(...args)=>(billing.hasPaidCompany(company)?billing.runSaved(company):runUnmetered)(...args)};
  }
  const server=createServer(async(req,res)=>{
    const send=(status,value,type='application/json')=>{
      res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});
      res.end(type==='application/json'?JSON.stringify(value):value);
    };
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/api/billing/webhook' && req.method==='POST'){
        // Machine callback: same host/TLS checks, authenticated by Stripe's raw-body signature.
        // All browser-facing writes still require their normal Origin/session checks.
        policy.guard({method:'GET',url:req.url,headers:req.headers,socket:req.socket});
        if(!billing.ready)fail(503,'Billing is not configured.');
        let size=0;const chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>262144)fail(413,'Webhook is too large.');chunks.push(chunk);}
        await billing.webhook(Buffer.concat(chunks),req.headers['stripe-signature']);return send(200,{received:true});
      }
      policy.guard(req);
      if(!policy.hosted && req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) fail(403,'Cross-origin requests are blocked.');
      if(req.headers['sec-fetch-site']==='cross-site' && !(policy.hosted && isPublicEntryNavigation(req))) fail(403,'Cross-site requests are blocked.');
      if(await auth.handle(req,url,json,send,res)) return;
      if(req.method==='GET') {
        if(url.pathname==='/.well-known/assetlinks.json') return send(200,JSON.parse(readFileSync(join(ROOT,'public/.well-known/assetlinks.json'),'utf8')));
        const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
        const files={'terms.html':'text/html','privacy.html':'text/html','refunds.html':'text/html','billing.js':'text/javascript','api.js':'text/javascript','manifest.webmanifest':'application/manifest+json','phone.js':'text/javascript','sw.js':'text/javascript','offline.html':'text/html','app-icon-192.png':'image/png','app-icon-512.png':'image/png','index.html':'text/html','photo-queue.js':'text/javascript','app.js':'text/javascript','measurements.js':'text/javascript','help.js':'text/javascript','currency.js':'text/javascript','equipment.js':'text/javascript','joe.js':'text/javascript','operations.js':'text/javascript','accounts.js':'text/javascript','materials.js':'text/javascript','company.js':'text/javascript','security.js':'text/javascript','style.css':'text/css','icon.svg':'image/svg+xml'};
        if(Object.hasOwn(files,file)) return send(200,readFileSync(join(ROOT,'public',file)),`${files[file]}; charset=utf-8`);
      }
      const session=auth.session(req);if(!session) fail(401,'Sign in to continue.');
      if(url.pathname==='/api/billing'){if(req.method!=='GET')fail(405,'Method not allowed.');return send(200,billing.status(session));}
      if(url.pathname.startsWith('/api/billing/')){
        if(!billing.ready)fail(503,'Billing is not configured.');
        if(req.method!=='POST')fail(405,'Method not allowed.');
        const b=await json(req);
        if(url.pathname==='/api/billing/checkout')return send(200,await billing.checkout(session,b.plan,b.terms_version));
        if(url.pathname==='/api/billing/confirm')return send(200,await billing.confirm(session,b.session_id));
        if(url.pathname==='/api/billing/sync')return send(200,await billing.sync(session));
        if(url.pathname==='/api/billing/cancel')return send(200,await billing.cancel(session));
        fail(404,'Billing action not found.');
      }
      if(req.headers['x-upload-id']&&(req.headers['x-upload-company']!==session.company_id||req.headers['x-upload-owner']!==encodeURIComponent(session.email)))fail(409,'Sign in to the original account and company to retry this upload.');
      if(url.pathname==='/api/security' && req.method==='GET') return send(200,{access:policy.hosted?'Secure hosted workspace':'This computer only',authentication:true,storageEncrypted:false,encryptedBackups:session.role==='Owner'});
      if(url.pathname.startsWith('/api/security/') && session.role!=='Owner') fail(403,'Only the owner can export a company backup.');
      if(!['GET','HEAD'].includes(req.method) && session.role==='Viewer' && !(url.pathname==='/api/joe'&&req.method==='POST')) fail(403,'Viewer access is read-only. Ask your company owner to change your role.');
      // Company identity comes only from the authenticated session, never request data.
      let workspace=workspaces.get(session.company_id);
      if(!workspace){const scopedCloud=companyCloud(session.company_id);workspace=createApp({dataDir:join(dataDir,'companies',session.company_id),cloud:scopedCloud,requestGuard:policy.guard,joeOptions:policy.hosted?{model:CLOUD_MODEL,provider:scopedCloud?'OpenAI cloud':'Cloud unavailable',runSaved:scopedCloud?.runSaved||runUnmetered,generate:scopedCloud?(messages,context,key)=>scopedCloud.chat(messages,context,session.company_id+':'+key):async()=>{throw Object.assign(new Error('Hosted Joe is not configured. The owner needs to connect the cloud service.'),{status:503});}}:{}});workspaces.set(session.company_id,workspace);}
      req.jobscopesActor={id:session.user_id,name:session.name,role:session.role};
      workspace.emit('request',req,res);
    } catch(e){if(!res.headersSent)send(e.status||500,{error:e.status?e.message:'Request failed. Please try again.'});}
  });
  server.requestTimeout=120000;
  server.on('close',()=>{for(const workspace of workspaces.values())workspace.emit('close');auth.close();cloud?.close();paidCloud?.close();budget?.close();billing.close();});
  return server;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.includes('--lan')){console.error('This preview requires localhost. Hosted HTTPS access is not configured.');process.exit(1);}
  const publicOrigin=process.env.PUBLIC_ORIGIN||(process.env.RENDER==='true'?process.env.RENDER_EXTERNAL_URL:'')||'';
  const server=createProduct({publicOrigin,registrationCode:process.env.PILOT_REGISTRATION_CODE||''}),port=Number(process.env.PORT||3200);
  server.listen(port,publicOrigin?'0.0.0.0':'127.0.0.1',()=>console.log(`ContractorSight company preview: http://localhost:${port}`));
  server.on('error',e=>{console.error(e.message);process.exitCode=1;server.close();});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close();server.closeIdleConnections();});
}

import { cloudAdapter } from './cloud-analysis.mjs';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { mkdirSync,readFileSync } from 'node:fs';
import { dirname,join,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { accounts } from './accounts.mjs';
import { createApp } from './workspace.mjs';
import { guardLocalRequest } from './security.mjs';
const ROOT=dirname(fileURLToPath(import.meta.url));
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
async function json(req) {
  if(!req.headers['content-type']?.startsWith('application/json')) fail(415,'Expected JSON.');
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>65536) fail(413,'Request too large.');chunks.push(chunk);}
  try{const b=JSON.parse(Buffer.concat(chunks));if(!b || typeof b!=='object' || Array.isArray(b)) fail(400,'Expected an object.');return b;}
  catch(e){if(e.status)throw e;fail(400,'Invalid JSON.');}
}
export function createProduct({dataDir=process.env.DATA_DIR||join(ROOT,'data')}={}) {
  mkdirSync(dataDir,{recursive:true});const auth=accounts(dataDir),workspaces=new Map();const cloud=existsSync(join(dataDir,'openai-key.dpapi'))?cloudAdapter({dataDir}):null;
  const server=createServer(async(req,res)=>{
    const send=(status,value,type='application/json')=>{
      res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"});
      res.end(type==='application/json'?JSON.stringify(value):value);
    };
    try {
      guardLocalRequest(req);
      if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}`) fail(403,'Cross-origin requests are blocked.');
      if(req.headers['sec-fetch-site']==='cross-site') fail(403,'Cross-site requests are blocked.');
      const url=new URL(req.url,'http://localhost');
      if(await auth.handle(req,url,json,send,res)) return;
      if(req.method==='GET') {
        const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
        const files={'index.html':'text/html','app.js':'text/javascript','measurements.js':'text/javascript','equipment.js':'text/javascript','joe.js':'text/javascript','operations.js':'text/javascript','accounts.js':'text/javascript','materials.js':'text/javascript','company.js':'text/javascript','security.js':'text/javascript','style.css':'text/css','icon.svg':'image/svg+xml'};
        if(Object.hasOwn(files,file)) return send(200,readFileSync(join(ROOT,'public',file)),`${files[file]}; charset=utf-8`);
      }
      const session=auth.session(req);if(!session) fail(401,'Sign in to continue.');
      if(url.pathname==='/api/security' && req.method==='GET') return send(200,{access:'This computer only',authentication:true,storageEncrypted:false,encryptedBackups:session.role==='Owner'});
      if(url.pathname.startsWith('/api/security/') && session.role!=='Owner') fail(403,'Only the owner can export a company backup.');
      if(!['GET','HEAD'].includes(req.method) && session.role==='Viewer' && !(url.pathname==='/api/joe'&&req.method==='POST')) fail(403,'Viewer access is read-only. Ask your company owner to change your role.');
      // Company identity comes only from the authenticated session, never request data.
      let workspace=workspaces.get(session.company_id);
      if(!workspace){workspace=createApp({dataDir:join(dataDir,'companies',session.company_id),cloud});workspaces.set(session.company_id,workspace);}
      req.jobscopesActor={id:session.user_id,name:session.name,role:session.role};
      workspace.emit('request',req,res);
    } catch(e){if(!res.headersSent)send(e.status||500,{error:e.status?e.message:'Request failed. Please try again.'});}
  });
  server.requestTimeout=120000;
  server.on('close',()=>{for(const workspace of workspaces.values())workspace.emit('close');auth.close();cloud?.close();});
  return server;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.includes('--lan')){console.error('This preview requires localhost. Hosted HTTPS access is not configured.');process.exit(1);}
  const server=createProduct(),port=Number(process.env.PORT||3200);
  server.listen(port,'127.0.0.1',()=>console.log(`ContractorSight company preview: http://localhost:${port}`));
  server.on('error',e=>{console.error(e.message);process.exitCode=1;server.close();});
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.close();server.closeIdleConnections();});
}

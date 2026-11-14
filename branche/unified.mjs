// Same-origin community integration. ContractorSight remains the authority for
// authentication; no passwords, browser tokens or billing identities are copied.
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {openStore,createHandler,termsVersion} from './app.mjs';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export async function unifiedCommunity(auth,{directory,databaseUrl='',publicOrigin='',...options}={}){
 if(publicOrigin&&!databaseUrl)fail(503,'The existing Branche database must be connected before enabling the shared app.');
 const store=await openStore({directory,databaseUrl}),q=store.query;
 await q('CREATE TABLE IF NOT EXISTS branche_identities(account TEXT PRIMARY KEY,uid TEXT UNIQUE NOT NULL)');
 async function identity(req,role='contractor'){
  const s=auth.session(req);if(!s)return null;
  let [mapping]=await q('SELECT uid FROM branche_identities WHERE account=?',[s.user_id]);
  if(!mapping){
   // Only a previously owner-verified connection may adopt a legacy profile.
   const [linked]=await q('SELECT uid FROM branche_workspaces WHERE owner=? AND company=?',[s.user_id,s.company_id]);
   const uid=linked&&auth.isOwner(s.user_id,s.company_id)?linked.uid:'account-'+s.user_id;
   // A private synthetic identifier avoids merging legacy accounts by email.
   await q('INSERT INTO branche_users VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',[uid,s.user_id+'@identity.invalid',s.name,role,randomBytes(16).toString('hex'),randomBytes(32).toString('hex'),termsVersion,Date.now()]);
   await q('INSERT INTO branche_identities VALUES(?,?) ON CONFLICT(account) DO NOTHING',[s.user_id,uid]);
   [mapping]=await q('SELECT uid FROM branche_identities WHERE account=?',[s.user_id]);
  }
  return (await q('SELECT id,name,role,email FROM branche_users WHERE id=?',[mapping.uid]))[0]||null;
 }
 const integration={session:identity,handle:async({path,req,res,body,send,limit})=>{
  if(path==='/api/branche/adopt-profile'){
   if(req.method!=='POST')fail(405,'Method not allowed.');
   const s=auth.session(req);if(!s)fail(401,'Sign in with your shared ContractorSight account first.');
   await limit('adopt:'+s.user_id,5,900000);
   const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
   const pass=typeof body.password==='string'&&body.password.length<=200?body.password.trim():'';
   const [legacy]=await q('SELECT * FROM branche_users WHERE email=?',[email]);
   const key=scryptSync(pass,legacy?.salt||'missing-user',32);
   const valid=timingSafeEqual(key,Buffer.from(legacy?.secret||'00'.repeat(32),'hex'));key.fill(0);
   if(!legacy||!valid||legacy.email.endsWith('@identity.invalid'))fail(401,'The previous Branche email or password is incorrect.');
   const [suspended]=await q('SELECT uid FROM branche_suspensions WHERE uid=?',[legacy.id]);
   if(suspended)fail(403,'This community account is suspended. Contact support.');
   const current=await identity(req);
   if(current.id===legacy.id){send(200,{saved:true});return true;}
   await store.transaction(async t=>{
    const [taken]=await t('SELECT account FROM branche_identities WHERE uid=?',[legacy.id]);
    if(taken)fail(409,'This page already belongs to another shared account. Contact support.');
    // Never replace a populated identity: that would hide posts or conversations.
    for(const table of ['branche_profiles','branche_posts','branche_jobs','branche_media'])if((await t('SELECT uid FROM '+table+' WHERE uid=?',[current.id])).length)fail(409,'This account already has community content. Contact support to combine it safely.');
    if((await t('SELECT id FROM branche_threads WHERE customer=? OR contractor=?',[current.id,current.id])).length)fail(409,'This account already has conversations. Contact support to combine it safely.');
    await t('UPDATE branche_identities SET uid=? WHERE account=?',[legacy.id,s.user_id]);
    await t('DELETE FROM branche_sessions WHERE uid=?',[legacy.id]);
   });
   send(200,{saved:true});return true;
  }
  if(['/api/branche/login','/api/branche/register','/api/branche/logout'].includes(path)){
   if(req.method!=='POST')fail(405,'Method not allowed.');
   const action=path.split('/').pop();
   if(action==='register'&&(body.terms!==termsVersion||!['customer','contractor'].includes(body.role)))fail(400,'Choose an account type and accept the community terms.');
   let result;
   await auth.handle(req,new URL('http://localhost/api/account/'+action),async()=>({...body,company:body.company||body.name+' workspace'}),(status,data)=>{result={status,data};},res);
   if(action==='logout')return send(result.status,result.data),true;
   const cookie=res.getHeader('Set-Cookie');
   const signed={...req,headers:{...req.headers,cookie:String(cookie).split(';')[0]}};
   const u=await identity(signed,action==='register'?body.role:'contractor');
   send(result.status,{user:{id:u.id,name:u.name,role:u.role},operator:(options.operationsOptions?.adminIds||process.env.BRANCHE_ADMIN_IDS?.split(',')||[]).includes(u.id)});return true;
  }
  if(path==='/api/branche/workspace'){
   if(req.method!=='GET')fail(405,'Your workspace uses this account automatically.');
   const s=auth.session(req);if(!s)fail(401,'Please sign in.');
   send(200,{unified:true,workspace:{name:s.company_name},url:'/'});return true;
  }
  if(path==='/api/branche/business-role'){
   if(req.method!=='POST')fail(405,'Method not allowed.');
   const u=await identity(req);if(!u)fail(401,'Please sign in.');
   if((await q('SELECT uid FROM branche_suspensions WHERE uid=?',[u.id])).length)fail(403,'This account is suspended.');
   await q("UPDATE branche_users SET role='contractor' WHERE id=?",[u.id]);send(200,{saved:true});return true;
  }
  if(['/api/branche/account-delete','/api/branche/reset-request','/api/branche/reset-password'].includes(path)){
   fail(409,'Use the shared account controls in ContractorSight, or contact kreischtech@gmail.com for account recovery or deletion.');
  }
  return false;
 }};
 const handler=createHandler(store,{...options,integration,publicOrigin});
 const assets={'/community/':'index.html','/community/app.js':'app.js','/community/style.css':'style.css','/community/safety.html':'safety.html','/community/privacy.html':'privacy.html'};
 return {close:()=>store.close(),handle:async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/branche/')&&!['/api/branche/redeem','/api/branche/link-code'].includes(path)){await handler(req,res);return true;}
  if(path==='/community'){res.writeHead(302,{Location:'/community/'});res.end();return true;}
  const asset=assets[path];if(!asset)return false;
  if(req.method!=='GET'){res.writeHead(405);res.end();return true;}
  let content=readFileSync(new URL('./public/'+asset,import.meta.url),'utf8');
  if(asset==='index.html')content=content.replaceAll('href="/','href="/community/').replaceAll('src="/','src="/community/').replace('Open ContractorSight ↗','Business tools').replace('https://contractorsight-pilot.onrender.com/','/').replace('target="_blank" rel="noopener"','');
  if(asset==='app.js')content=content.replaceAll('/safety.html','/community/safety.html').replaceAll('/privacy.html','/community/privacy.html').replaceAll('https://contractorsight-pilot.onrender.com/','/').replaceAll('href="/" target="_blank" rel="noopener"','href="/"').replaceAll('Opens the existing app. Separate sign-in; paid tools have their own plans.','Your business tools, using this same account. Paid features use your plan or credits.');
  if(asset==='privacy.html'){
   content=content.replace('Vercel hosts the app and uploaded images. Neon hosts account and community records. Google Gmail sends recovery emails when configured.','Render hosts the shared app and ContractorSight sign-in and workspace records. Neon stores community records. Vercel Blob stores community images. Recovery is handled through the shared account support process.');
   content=content.replace(/<h2>ContractorSight connection<\/h2><p>[\s\S]*?<\/p>/,'<h2>One shared account</h2><p>Branche and ContractorSight use one account and sign-in session. Community records are associated with your shared account identifier. Business workspace records are not published to the community. An existing preview profile can be brought into your account after you prove ownership.</p>');
   content=content.replace(/<h2>Retention and deletion<\/h2><p>[\s\S]*?<\/p>/,'<h2>Retention and deletion</h2><p>Request shared-account deletion at <a href="/delete-account.html">Account and data deletion</a>. Specify whether to include your community page, posts, images and conversations, and your company workspace. Support verifies ownership and confirms scope before deletion. Removing community data does not authorize deletion of another person’s company. Provider backups and security logs may retain copies until their retention expires.</p>');
  }
  if(asset==='safety.html')content=content.replace('You can delete your Branche account from the account menu after confirming your password.','Use Request account deletion in the shared account menu to request removal of your community and account data.');
  if(asset.endsWith('.html')&&asset!=='index.html')content=content.replaceAll('href="/style.css"','href="/community/style.css"').replaceAll('href="/"','href="/community/"').replaceAll('href="/privacy.html"','href="/community/privacy.html"');
  res.writeHead(200,{'Content-Type':asset.endsWith('.js')?'text/javascript':asset.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(content);return true;
 }};
}

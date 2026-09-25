import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {createProduct} from '../server.mjs';

test('authenticated companies: isolation, roles, invitations, sessions and persistence',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'jobscopes-accounts-'));let server,base;
  const start=async()=>{server=createProduct({dataDir:dir});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;};
  const stop=()=>new Promise(r=>{server.close(r);server.closeIdleConnections();});
  t.after(async()=>{if(server.listening)await stop();rmSync(dir,{recursive:true,force:true});});await start();
  const password='long test-only password 2026';
  const client=()=>({cookie:'',async request(path,method='GET',body,expected=200,headers={}){const r=await fetch(base+path,{method,headers:{Cookie:this.cookie,...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie')){this.lastCookie=r.headers.get('set-cookie');this.cookie=this.lastCookie.split(';')[0];}const b=await r.json();assert.equal(r.status,expected,JSON.stringify(b));return b;}});
  const a=client(),b=client(),v=client(),anon=client();let ac,bc,project,photo,viewerId;
  await t.test('anonymous access is denied; registration does not accept a role',async()=>{
    for(const path of ['/api/projects','/api/company','/api/security/backup','/api/photos/missing'])await anon.request(path,'GET',undefined,401);
    await a.request('/api/account/register','POST',{email:'owner-a@example.test',password,name:'Owner A',company:'A Construction',role:'Viewer'},201);
    assert.match(a.lastCookie,/HttpOnly/);assert.match(a.lastCookie,/SameSite=Strict/);
    ac=(await a.request('/api/account/session')).company;assert.equal(ac.role,'Owner');
    await b.request('/api/account/register','POST',{email:'owner-b@example.test',password,name:'Owner B',company:'B Contractors'},201);bc=(await b.request('/api/account/session')).company;
    await v.request('/api/account/register','POST',{email:'viewer@example.test',password,name:'Office reader',company:'Independent company'},201);
    await anon.request('/api/account/login','POST',{email:'owner-a@example.test',password:'wrong but sufficiently long'},401);
  });
  await t.test('projects, photos, estimates and money cannot cross company boundaries',async()=>{
    project=await a.request('/api/projects','POST',{name:'A private job',type:'Basement',status:'Planning',client:'Private customer'},201);
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
    const r=await fetch(base+`/api/projects/${project.id}/photos?name=private.png`,{method:'POST',headers:{Cookie:a.cookie},body:png});assert.equal(r.status,201);photo=await r.json();
    await a.request('/api/company/entries','POST',{entry_date:'2026-01-01',type:'Payment received',category:'Other',amount:'2500',description:'Private receipt',status:'Recorded',project_id:project.id},201);
    await b.request(`/api/projects/${project.id}`,'GET',undefined,404);
    await b.request(`/api/photos/${photo.id}`,'GET',undefined,404);
    await b.request(`/api/projects/${project.id}/estimate`,'GET',undefined,404);
    assert.deepEqual(await b.request('/api/projects?company_id='+ac.id,'GET',undefined,200,{'X-Company-Id':ac.id}),[]);
    assert.equal((await b.request('/api/company?year=2026')).totals.entry_count,0);
    await b.request('/api/account/switch','POST',{company_id:ac.id},403);
    assert.equal((await a.request('/api/projects')).length,1);
    const asset=await a.request('/api/equipment','POST',{name:'Truck',tag:'TR-1',type:'Vehicle',status:'Available',meter:'Miles'},201);
    const uploaded=await fetch(base+`/api/equipment/${asset.id}/photos`,{method:'POST',headers:{Cookie:a.cookie},body:png});assert.equal(uploaded.status,201);
    const assetPhoto=await uploaded.json();
    await b.request(`/api/equipment/${asset.id}/photos/${assetPhoto.id}`,'GET',undefined,404);
    await anon.request(`/api/equipment/${asset.id}/photos/${assetPhoto.id}`,'GET',undefined,401);
    const read=await fetch(base+`/api/equipment/${asset.id}/photos/${assetPhoto.id}`,{headers:{Cookie:a.cookie}});assert.equal(read.status,200);assert.equal(read.headers.get('content-type'),'image/png');
    assert.deepEqual(Buffer.from(await read.arrayBuffer()),png);
    await a.request(`/api/equipment/${asset.id}/photos/${assetPhoto.id}/analysis`,'POST',{context:'',cloud_consent:true},503);
    assert.equal((await a.request(`/api/equipment/${asset.id}/photos`)).photos.length,1);
  });
  await t.test('invitation is email-bound, single-use; viewers cannot mutate or export',async()=>{
    const inv=await a.request('/api/account/invites','POST',{email:'viewer@example.test',role:'Viewer'},201);
    await b.request('/api/account/join','POST',{code:inv.code},400);
    await v.request('/api/account/join','POST',{code:inv.code});
    await v.request('/api/account/join','POST',{code:inv.code},400);
    await v.request('/api/account/switch','POST',{company_id:ac.id});
    assert.equal((await v.request('/api/projects')).length,1);
    for(const [path,method,body] of [['/api/projects','POST',{}],[`/api/projects/${project.id}`,'PUT',{}],['/api/company/entries','POST',{}],['/api/security/backup','POST',{password}],['/api/account/invites','POST',{email:'bad@example.test',role:'Manager'}]])await v.request(path,method,body,403);
    await v.request('/api/account/team','GET',undefined,403);
    viewerId=(await a.request('/api/account/team')).members.find(m=>m.email==='viewer@example.test').id;
    await b.request('/api/account/member','PUT',{user_id:viewerId,role:'Removed'},403);
  });
  await t.test('role changes revoke sessions; managers edit but cannot administer access',async()=>{
    await a.request('/api/account/member','PUT',{user_id:viewerId,role:'Manager'});
    await v.request('/api/projects','GET',undefined,401);
    await v.request('/api/account/login','POST',{email:'viewer@example.test',password});await v.request('/api/account/switch','POST',{company_id:ac.id});
    await v.request('/api/projects','POST',{name:'Manager job',type:'Deck',status:'Discovery'},201);
    await v.request('/api/account/invites','POST',{email:'x@example.test',role:'Viewer'},403);
    const pending=await a.request('/api/account/invites','POST',{email:'viewer@example.test',role:'Viewer'},201);
    await a.request('/api/account/member','PUT',{user_id:viewerId,role:'Removed'});await v.request('/api/projects','GET',undefined,401);
    await v.request('/api/account/login','POST',{email:'viewer@example.test',password});
    await v.request('/api/account/join','POST',{code:pending.code},400);
  });
  await t.test('multiple active companies and overlapping jobs persist after restart',async()=>{
    await a.request('/api/account/companies','POST',{name:'A Second Division'},201);assert.equal((await a.request('/api/projects')).length,0);
    for(let i=0;i<15;i++)await a.request('/api/projects','POST',{name:`Concurrent job ${i+1}`,type:'General remodeling',status:'In progress'},201);
    await stop();await start();assert.equal((await a.request('/api/projects')).length,15);
    await a.request('/api/account/switch','POST',{company_id:ac.id});assert.equal((await a.request('/api/projects')).length,2);
    assert.equal((await b.request('/api/account/session')).company.id,bc.id);assert.equal((await b.request('/api/projects')).length,0);
    await a.request('/api/account/logout','POST',{});await a.request('/api/projects','GET',undefined,401);
  });
  await t.test('expired sessions and cross-origin writes fail; secrets are not stored in plaintext',async()=>{
    const db=new DatabaseSync(join(dir,'accounts.sqlite'));
    try {
      const user=db.prepare('SELECT * FROM users WHERE email=?').get('owner-b@example.test');assert.notEqual(user.password_hash,password);
      const token=b.cookie.split('=')[1];assert.equal(db.prepare('SELECT token_hash FROM sessions WHERE token_hash=?').get(token),undefined);
      await b.request('/api/account/companies','POST',{name:'CSRF'},403,{Origin:'https://evil.example'});
      db.prepare('UPDATE sessions SET expires=0 WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));
      await b.request('/api/projects','GET',undefined,401);
    } finally {db.close();}
  });
});

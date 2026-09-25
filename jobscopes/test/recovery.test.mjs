import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createProduct} from '../server.mjs';
import {issueRecovery} from '../recover-account.mjs';

test('operator recovery preserves jobs, rejects expired/reused codes and revokes old sessions',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'recovery-')),server=createProduct({dataDir:dir});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}`,email='owner@example.test',password='old testing password 2026',next='new testing password 2026';
 async function request(path,body,cookie=''){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 const owner=await request('/api/account/register',{email,password,name:'Owner',company:'Recovery test'});assert.equal(owner.status,201);
 const other=await request('/api/account/register',{email:'other@example.test',password,name:'Other',company:'Other company'});
 assert.equal((await request('/api/projects',{name:'Keep this job',type:'Deck',status:'Discovery'},owner.cookie)).status,201);
 const expired=issueRecovery(dir,email,Date.now()-31*60000);
 assert.equal((await request('/api/account/reset-password',{email,password:next,code:expired})).status,400);
 const code=issueRecovery(dir,email);
 assert.equal((await request('/api/account/reset-password',{email:'other@example.test',password:next,code})).status,400);
 const attempts=await Promise.all([1,2].map(()=>request('/api/account/reset-password',{email,password:next,code})));
 assert.deepEqual(attempts.map(a=>a.status).sort(),[200,400]);
 assert.equal((await request('/api/projects',null,owner.cookie)).status,401);
 assert.equal((await request('/api/projects',null,other.cookie)).status,200);
 assert.equal((await request('/api/account/login',{email,password})).status,401);
 const login=await request('/api/account/login',{email,password:next});assert.equal(login.status,200);
 assert.equal((await request('/api/projects',null,login.cookie)).body[0].name,'Keep this job');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore,createHandler,termsVersion} from '../app.mjs';
test('operators review reports, suspensions stop writes, and account deletion is isolated and password protected',async()=>{
 const store=await openStore({directory:mkdtempSync(join(tmpdir(),'branche-ops-'))}),admins=[];
 const server=createServer(createHandler(store,{operationsOptions:{adminIds:admins,deleteFile:async()=>{}}}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(path,body,cookie='',method=body?'POST':'GET')=>{const r=await fetch(base+'/api/branche/'+path,{method,headers:{cookie,origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 try{
 const reg=name=>call('register',{name,email:name+'@example.test',password:'test-only-password',role:'contractor',terms:termsVersion});
 const a=await reg('Operator'),b=await reg('Business'),c=await reg('Reporter');admins.push(a.data.user.id);
 const post=await call('posts',{title:'Test',category:'Carpentry',city:'Mentor',description:'Test post'},b.cookie);
 await call('report',{kind:'post',target:post.data.id,reason:'Test concern'},c.cookie);
 assert.equal((await call('admin/reports',null,b.cookie)).status,403);
 const report=(await call('admin/reports',null,a.cookie)).data.reports[0];
 assert.equal((await call('admin/report?id='+report.id,null,a.cookie)).data.content[0].uid,b.data.user.id);
 assert.equal((await call('admin/report',{id:report.id,action:'suspend',author:c.data.user.id},a.cookie,'PUT')).status,400);
 assert.equal((await call('admin/report',{id:report.id,action:'suspend',author:b.data.user.id},a.cookie,'PUT')).status,200);
 assert.equal((await call('posts')).data.posts.length,0);
 assert.equal((await call('posts',{title:'Again'},b.cookie)).status,403);
 assert.equal((await call('account-delete',{password:'wrong'},b.cookie)).status,401);
 assert.equal((await call('account-delete',{password:'test-only-password'},b.cookie)).status,200);
 assert.equal((await call('session',null,b.cookie)).data.user,null);
 assert.equal((await call('session',null,c.cookie)).data.user.id,c.data.user.id);
 assert.equal((await store.query('SELECT id FROM branche_users')).length,2);
 await assert.rejects(store.transaction(async q=>{await q('DELETE FROM branche_users');throw Error('rollback-test');}),/rollback-test/);
 assert.equal((await store.query('SELECT id FROM branche_users')).length,2);
 }finally{await new Promise(r=>server.close(r));await store.close();}
});

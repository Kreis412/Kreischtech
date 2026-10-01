import {request as httpRequest} from 'node:http';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createProduct} from '../server.mjs';
import {backupInstallation,restoreInstallation} from '../installation-backup.mjs';
import {accessPolicy} from '../access.mjs';
test('hosted policy rejects untrusted host, insecure forwarding and cross-origin writes',()=>{
 assert.throws(()=>accessPolicy('http://example.test'));
 assert.throws(()=>accessPolicy('https://example.test/'));
 const policy=accessPolicy('https://example.test');
 const request={method:'POST',headers:{host:'example.test','x-forwarded-proto':'https',origin:'https://example.test'}};
 assert.doesNotThrow(()=>policy.guard(request));
 for(const headers of [{host:'other.test'},{'x-forwarded-proto':'http'},{origin:'https://other.test'},{origin:undefined},{'sec-fetch-site':'cross-site'}]) assert.throws(()=>policy.guard({...request,headers:{...request.headers,...headers}}));
});
test('shared links open only the public entry document; cross-site APIs and writes stay blocked',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'contractorsight-entry-'));
 const server=createProduct({dataDir:dir,publicOrigin:'https://example.test'});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});});
 const headers={host:'example.test','x-forwarded-proto':'https','sec-fetch-site':'cross-site','sec-fetch-mode':'navigate','sec-fetch-dest':'document'};
 const request=(path,method='GET',extra={})=>new Promise((resolve,reject)=>{
  const req=httpRequest({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{...headers,...extra}},res=>{
   let body='';res.on('data',c=>body+=c);res.on('end',()=>resolve({status:res.statusCode,body}));
  });req.on('error',reject);req.end();
 });
 for(const path of ['/','/index.html','/?from=invitation']){
  const r=await request(path);assert.equal(r.status,200);assert.match(r.body,/ContractorSight/);
 }
 for(const path of ['/api/account/session','/api/projects','/api/photos/example','/accounts.js'])assert.equal((await request(path)).status,403);
 for(const extra of [{host:'other.test'},{'x-forwarded-proto':'http'}])assert.equal((await request('/','GET',extra)).status,403);
 // Some embedded checkout browsers omit navigation metadata on the return.
 const returnHeaders={...headers,origin:'https://checkout.stripe.com'};
 delete returnHeaders['sec-fetch-mode'];delete returnHeaders['sec-fetch-dest'];
 assert.doesNotThrow(()=>accessPolicy('https://example.test').guard({method:'GET',url:'/?stripe_session=cs_test_example',headers:returnHeaders}));
 assert.throws(()=>accessPolicy('https://example.test').guard({method:'GET',url:'/api/billing',headers:returnHeaders}));
 assert.equal((await request('/','POST')).status,403);
 assert.equal((await request('/api/account/login','POST',{origin:'https://other.test'})).status,403);
});
test('hosted gateway supports shared project access with Secure sessions',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'contractorsight-hosted-'));
 let server=createProduct({dataDir:dir,publicOrigin:'https://example.test',registrationCode:'test-pilot-code'});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(r=>{server.close(r);server.closeIdleConnections();});rmSync(dir,{recursive:true,force:true});});
 let base=`http://127.0.0.1:${server.address().port}`;
 const headers={host:'example.test','x-forwarded-proto':'https',origin:'https://example.test','content-type':'application/json'};
 const request=(path,method='GET',body)=>new Promise((resolve,reject)=>{const req=httpRequest(base+path,{method,headers},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:{get:key=>Array.isArray(res.headers[key])?res.headers[key][0]:res.headers[key]},json:async()=>JSON.parse(text)}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});
 let rejected=await request('/api/account/register','POST',{email:'denied@example.test',password:'hosted testing password 2026',name:'Test',company:'Test'});assert.equal(rejected.status,403);
 let r=await request('/api/account/register','POST',{email:'hosted@example.test',password:'hosted testing password 2026',name:'Test owner',company:'Mock company',registration_code:'test-pilot-code'});
 assert.equal(r.status,201);assert.match(r.headers.get('set-cookie'),/; Secure/);headers.cookie=r.headers.get('set-cookie').split(';')[0];
 r=await request('/api/projects','POST',{name:'Phone pilot fixture',type:'Deck',status:'Discovery'});assert.equal(r.status,201);
 const project=await r.json();r=await request('/api/projects/'+project.id);assert.equal(r.status,200);assert.equal((await r.json()).name,'Phone pilot fixture');
 r=await request('/api/account/logout','POST',{});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/; Secure/);
 await new Promise(resolve=>{server.close(resolve);server.closeIdleConnections();});
 const archive=join(dir,'..',dir.split(/[\\/]/).pop()+'.enc'),restored=join(dir,'restored');
 t.after(()=>rmSync(archive,{force:true}));
 await backupInstallation(dir,archive,'test recovery password 2026');
 await restoreInstallation(archive,restored,'test recovery password 2026');
 server=createProduct({dataDir:restored,publicOrigin:'https://example.test'});server.listen(0,'127.0.0.1');await once(server,'listening');base=`http://127.0.0.1:${server.address().port}`;
 delete headers.cookie;r=await request('/api/account/login','POST',{email:'hosted@example.test',password:'hosted testing password 2026'});assert.equal(r.status,200);headers.cookie=r.headers.get('set-cookie').split(';')[0];
 r=await request('/api/projects/'+project.id);assert.equal(r.status,200);assert.equal((await r.json()).name,'Phone pilot fixture');
});

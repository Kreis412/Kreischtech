import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {createProduct} from '../../jobscopes/server.mjs';
import {openStore,createHandler,termsVersion} from '../app.mjs';
test('business linking verifies both accounts, rejects replay and duplicate links, preserves workspace',async()=>{
 const cs=createProduct({dataDir:mkdtempSync(join(tmpdir(),'cs-link-'))});cs.listen(0,'127.0.0.1');await once(cs,'listening');
 const csBase='http://127.0.0.1:'+cs.address().port;
 const store=await openStore({directory:mkdtempSync(join(tmpdir(),'branche-link-'))});
 const server=createServer(createHandler(store,{workspaceRequest:(_url,options)=>fetch(csBase+'/api/branche/redeem',options)}));server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const call=async(origin,path,body,cookie='',method=body?'POST':'GET')=>{const r=await fetch(origin+path,{method,headers:{origin,cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 try{
  const csUser=await call(csBase,'/api/account/register',{name:'Owner',company:'Existing Business',email:'owner@example.test',password:'long integration test passphrase'});assert.equal(csUser.status,201);
  const before=await call(csBase,'/api/account/session',null,csUser.cookie);
  const project=await call(csBase,'/api/projects',{name:'Existing project',type:'Deck',status:'Planning'},csUser.cookie);assert.equal(project.status,201);
  const register=name=>call(base,'/api/branche/register',{name,email:name+'@example.test',role:'contractor',password:'long integration test passphrase',terms:termsVersion});
  const a=await register('First'),b=await register('Second');
  const issue=()=>call(csBase,'/api/branche/link-code',{},csUser.cookie);
  assert.equal((await call(csBase,'/api/branche/link-code',{})).status,401);
  const code=(await issue()).data.code;
  assert.equal((await call(csBase,'/api/branche/redeem',{code})).status,403,'Browser redemption blocked');
  assert.equal((await call(base,'/api/branche/workspace',{code},a.cookie)).status,200);
  assert.equal((await call(base,'/api/branche/workspace',{code},b.cookie)).status,400,'Code cannot replay');
  assert.equal((await call(base,'/api/branche/workspace',{code:(await issue()).data.code},b.cookie)).status,409,'Company cannot link twice');
  assert.equal((await call(base,'/api/branche/workspace',null,a.cookie)).data.workspace.name,'Existing Business');
  assert.equal((await call(base,'/api/branche/workspace',null,b.cookie)).data.workspace,null);
  assert.equal((await call(base,'/api/branche/workspace',{},a.cookie,'DELETE')).status,200);
  assert.equal((await call(csBase,'/api/projects',null,csUser.cookie)).data[0].id,project.data.id);
  assert.deepEqual((await call(csBase,'/api/account/session',null,csUser.cookie)).data.company,before.data.company);
 }finally{await new Promise(r=>server.close(r));await store.close();await new Promise(r=>cs.close(r));}
});

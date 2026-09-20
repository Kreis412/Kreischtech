import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {joeStore,askLocalJoe} from '../joe.mjs';import {acquireLocalModel} from '../local-model.mjs';
test('Joe isolates chat history, excludes unselected context, and deduplicates saved questions',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT,type TEXT,status TEXT,notes TEXT);INSERT INTO projects VALUES('a','Job','Deck','Planning','Scope only');CREATE TABLE operations_records(id TEXT,project_id TEXT,kind TEXT,data TEXT,revision INTEGER,updated_at TEXT);CREATE TABLE finding_history(project_id TEXT,finding_id TEXT,event TEXT,data TEXT,seq INTEGER);`);
 const calls=[];const joe=joeStore(db,{generate:async(messages,context)=>{calls.push({messages,context});return 'Draft answer';}});
 async function request(body,user='owner',method='POST',pid='a'){let out;await joe.handle({method,jobscopesActor:{id:user,name:user,role:user==='viewer'?'Viewer':'Owner'}},new URL('http://localhost/api/joe?project_id='+pid),id=>{if(id!=='a')throw Object.assign(Error(),{status:404});},async()=>body,(status,value)=>out={status,...value});return out;}
 const b={question:'Help plan this job',request_id:'request-number-one',project_id:'a',include_context:true};assert.equal((await request(b)).status,201);assert.equal(calls[0].context.project.name,'Job');
 assert.equal((await request(b)).reused,true);assert.equal(calls.length,1);
 assert.equal((await request({},'viewer','GET')).history.length,0);
 await request({...b,request_id:'request-number-two',question:'General question',include_context:false});assert.equal(calls[1].context,null);assert.equal(calls[1].messages.length,1);
 await assert.rejects(request({...b,project_id:'foreign',request_id:'request-number-three'}),e=>e.status===404);
 await assert.rejects(request(b,'viewer'),e=>e.status===409);
 await request({...b,request_id:'viewer-request-one',include_context:false},'viewer');assert.equal((await request({},'viewer','GET')).history.length,1);assert.equal((await request({},'owner','GET')).history.length,2);db.close();
});
test('Joe provider uses localhost, unloads model and releases busy lock after failures',async()=>{
 let count=0;const fake=async(url,opts)=>{assert.ok(url.startsWith('http://127.0.0.1:11434/'));assert.equal(opts.redirect,'error');const b=JSON.parse(opts.body);if(count++===0)return {ok:true,json:async()=>({capabilities:['completion']})};assert.equal(b.keep_alive,0);assert.equal(b.model,'llama3.1:8b');assert.equal(b.messages.at(-1).content,'Hello');return {ok:true,json:async()=>({done:true,message:{content:'Hello there'}})};};
 assert.equal(await askLocalJoe([{role:'user',content:'Hello'}],null,fake),'Hello there');
 const release=acquireLocalModel();await assert.rejects(askLocalJoe([],null,fake),e=>e.status===429);release();
 await assert.rejects(askLocalJoe([],null,async()=>{throw Error('offline');}),e=>e.status===503);const again=acquireLocalModel();again();
 await assert.rejects(askLocalJoe([],null,async()=>({ok:true,json:async()=>({capabilities:['completion'],remote_host:'cloud'})})),e=>e.status===503);
});

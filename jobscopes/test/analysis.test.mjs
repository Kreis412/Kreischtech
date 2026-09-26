import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {analysisStore,analyzeLocal,validateResult} from '../analysis.mjs';
const result={summary:'Visible conditions need verification.',findings:[{title:'Low duct',observation:'A duct crosses the ceiling.',uncertainty:'Clearance cannot be measured from this image.',next_step:'Measure the lowest clearance on site.'}]};
test('local adapter limits data, rejects cloud routing and validates structured drafts',async()=>{
 let call=0;
 const fake=async(url,opts)=>{assert.ok(url.startsWith('http://127.0.0.1:11434/'));assert.equal(opts.redirect,'error');const b=JSON.parse(opts.body);assert.equal(b.model,'gemma3:4b');call++;if(call===1)return {ok:true,json:async()=>({capabilities:['vision']})};assert.equal(b.keep_alive,0);assert.equal(b.stream,false);assert.equal(b.messages[1].images[0],Buffer.from('photo').toString('base64'));return {ok:true,json:async()=>({done:true,done_reason:'stop',message:{content:JSON.stringify(result)}})};};
 assert.deepEqual(await analyzeLocal(Buffer.from('photo'),'context',fake),result);
 await assert.rejects(analyzeLocal(Buffer.from('photo'),'',async()=>({ok:true,json:async()=>({capabilities:['vision'],remote_host:'cloud'})})),e=>e.status===503);
 await assert.rejects(analyzeLocal(Buffer.from('photo'),'',async()=>{throw Object.assign(new Error('timeout'),{name:'TimeoutError'});}),e=>e.status===504);
 assert.throws(()=>validateResult({summary:'bad',findings:[{title:'Missing fields'}]}),e=>e.status===502);
 assert.throws(()=>validateResult({...result,findings:Array(7).fill(result.findings[0])}),e=>e.status===502);
});
test('analysis persists only unreviewed project-scoped drafts with provenance and deduplicates retries',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE projects(id TEXT PRIMARY KEY);INSERT INTO projects VALUES('a'),('b');CREATE TABLE photos(id TEXT PRIMARY KEY,project_id TEXT,content BLOB);INSERT INTO photos VALUES('photo','a',X'0102');CREATE TABLE operations_records(id TEXT PRIMARY KEY,project_id TEXT,kind TEXT,data TEXT,revision INTEGER,created_at TEXT,updated_at TEXT);`);
 let calls=0;const store=analysisStore(db,{analyze:async()=>{calls++;return result;}});
 async function req(pid,body,role='Owner',method='POST'){let reply;await store.handle({method,jobscopesActor:{name:'Reviewer',role}},new URL(`http://localhost/api/projects/${pid}/analysis`),()=>{},async()=>body,(status,value)=>reply={status,value});return reply;}
 await assert.rejects(req('b',{photo_id:'photo'}),e=>e.status===404);
 await assert.rejects(req('a',{photo_id:'photo'},'Viewer'),e=>e.status===403);
 const saved=await req('a',{photo_id:'photo',context:'Known context'});assert.equal(saved.status,201);assert.equal(saved.value.count,1);
 const f=JSON.parse(db.prepare('SELECT data FROM operations_records').get().data);assert.equal(f.status,'Needs review');assert.equal(f.source,'Local AI draft');assert.equal(f.reviewed_by,null);assert.equal(f.photo_id,'photo');assert.equal(f.model,'gemma3:4b');
 assert.equal((await req('a',{photo_id:'photo'})).value.reused,true);assert.equal(calls,1);assert.equal((await req('b',{},'Owner','GET')).value.runs.length,0);
 db.close();
});
test('invalid generation leaves no partial records and releases the analysis lock',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);INSERT INTO projects VALUES('a');CREATE TABLE photos(id TEXT PRIMARY KEY,project_id TEXT,content BLOB);INSERT INTO photos VALUES('photo','a',X'0102');CREATE TABLE operations_records(id TEXT PRIMARY KEY,project_id TEXT,kind TEXT,data TEXT,revision INTEGER,created_at TEXT,updated_at TEXT);`);
 let valid=false;const store=analysisStore(db,{analyze:async()=>valid?result:{summary:'invalid',findings:[{}]}});
 const run=()=>store.handle({method:'POST',jobscopesActor:{name:'Owner',role:'Owner'}},new URL('http://localhost/api/projects/a/analysis'),()=>{},async()=>({photo_id:'photo'}),()=>{});
 await assert.rejects(run(),e=>e.status===502);assert.equal(db.prepare('SELECT count(*) n FROM photo_analyses').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM operations_records').get().n,0);valid=true;await run();assert.equal(db.prepare('SELECT count(*) n FROM photo_analyses').get().n,1);db.close();
});

test('cloud selection requires consent and saves model provenance with retry deduplication',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);INSERT INTO projects VALUES('a');CREATE TABLE photos(id TEXT PRIMARY KEY,project_id TEXT,content BLOB);INSERT INTO photos VALUES('photo','a',X'0102');CREATE TABLE operations_records(id TEXT PRIMARY KEY,project_id TEXT,kind TEXT,data TEXT,revision INTEGER,created_at TEXT,updated_at TEXT);`);
 let calls=0;const store=analysisStore(db,{cloud:{status:()=>({remaining_attempts:1}),analyze:async()=>{calls++;return result;}}});
 const run=async b=>{let reply;await store.handle({method:'POST',jobscopesActor:{name:'Owner',role:'Owner'}},new URL('http://localhost/api/projects/a/analysis'),()=>{},async()=>b,(status,value)=>reply=value);return reply;};
 try{await assert.rejects(run({photo_id:'photo',provider:'openai'}),e=>e.status===400);assert.equal(calls,0);const b={photo_id:'photo',provider:'openai',cloud_consent:true};await run(b);assert.equal((await run(b)).reused,true);assert.equal(calls,1);const f=JSON.parse(db.prepare('SELECT data FROM operations_records').get().data);assert.equal(f.source,'Cloud AI draft');assert.equal(f.model,'gpt-6-astra');assert.equal(f.status,'Needs review');}finally{db.close();}
});

test('blueprints use dedicated prompts and separate saved results without extra retry charges',async()=>{
 const {BLUEPRINT_PROMPT,REVIEW_PROMPT}=await import('../analysis.mjs');
 const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);INSERT INTO projects VALUES('a'),('b');CREATE TABLE photos(id TEXT PRIMARY KEY,project_id TEXT,content BLOB);INSERT INTO photos VALUES('photo','a',X'0102');CREATE TABLE operations_records(id TEXT PRIMARY KEY,project_id TEXT,kind TEXT,data TEXT,revision INTEGER,created_at TEXT,updated_at TEXT);`);
 const prompts=[];const store=analysisStore(db,{cloud:{status:()=>({}),analyze:async(image,context,prompt)=>{prompts.push(prompt);return result;}}});
 async function run(body,method='POST',pid='a',role='Owner'){let reply;await store.handle({method,jobscopesActor:{name:'Tester',role}},new URL(`http://localhost/api/projects/${pid}/analysis`),()=>{},async()=>body,(status,value)=>reply=value);return reply;}
 try{
 const body={photo_id:'photo',provider:'openai',cloud_consent:true,mode:'blueprint'};
 await assert.rejects(run({...body,mode:'invalid'}),e=>e.status===400);
 await assert.rejects(run({...body,cloud_consent:false}),e=>e.status===400);
 await assert.rejects(run(body,'POST','b'),e=>e.status===404);
 await assert.rejects(run(body,'POST','a','Viewer'),e=>e.status===403);
 await run({...body,mode:'site'});await run(body);assert.equal((await run(body)).reused,true);
 assert.deepEqual(prompts,[REVIEW_PROMPT,BLUEPRINT_PROMPT]);
 assert.deepEqual((await run({},'GET')).runs.map(r=>r.mode).sort(),['blueprint','site']);
 const drafts=db.prepare('SELECT data FROM operations_records').all().map(r=>JSON.parse(r.data));assert.equal(drafts[1].analysis_mode,'blueprint');assert.equal(drafts[1].status,'Needs review');assert.match(drafts[1].source,/Blueprint/);
 analysisStore(db);assert.equal((await run({},'GET')).runs.length,2);assert.equal((await run({},'GET','b')).runs.length,0);
 }finally{db.close();}
});

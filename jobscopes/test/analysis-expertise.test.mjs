import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {analysisStore} from '../analysis.mjs';
import {businessExpertise} from '../business-expertise.mjs';
import {quickCost} from '../public/operations.js';
test('long measurement context and expertise reach analysis; refresh is explicit and retries are free',async()=>{
 const db=new DatabaseSync(':memory:');db.exec("CREATE TABLE projects(id TEXT PRIMARY KEY);INSERT INTO projects VALUES('a');CREATE TABLE photos(id TEXT PRIMARY KEY,project_id TEXT,content BLOB);INSERT INTO photos VALUES('photo','a',X'01');CREATE TABLE operations_records(id TEXT PRIMARY KEY,project_id TEXT,kind TEXT,data TEXT,revision INTEGER,created_at TEXT,updated_at TEXT)");
 let labels='Measured: 20 ft. '.repeat(200),calls=[];
 const store=analysisStore(db,{measurements:{context:()=>labels},expertise:()=> 'Professional carpenter',cloud:{status:()=>({}),analyze:async(image,context,prompt)=>{calls.push({context,prompt});return {summary:'Review',findings:[]};}}});
 const run=async extra=>{let result;await store.handle({method:'POST',jobscopesActor:{role:'Owner'}},new URL('http://localhost/api/projects/a/analysis'),()=>{},async()=>({photo_id:'photo',context:'Notes '.repeat(250),provider:'openai',cloud_consent:true,...extra}),(status,value)=>result=value);return result;};
 const first=await run();assert.equal(calls.length,1);assert.ok(calls[0].context.length>2000);assert.match(calls[0].context,/Professional carpenter/);assert.match(calls[0].prompt,/report concisely/);
 labels+='New line 12 ft';
 assert.equal((await run()).reused,true);assert.equal(calls.length,1);
 const second=await run({refresh:true,previous_id:first.id,detail:'detailed'});assert.equal(calls.length,2);assert.notEqual(second.id,first.id);assert.match(calls[1].context,/New line 12 ft/);assert.match(calls[1].prompt,/detailed explanation/);
 assert.equal((await run({refresh:true,previous_id:first.id,detail:'detailed'})).reused,true);assert.equal(calls.length,2);
 assert.equal((await run({refresh:true,previous_id:second.id,detail:'detailed'})).reused,true);assert.equal(calls.length,2);db.close();
});
test('business expertise is owner managed and quick cost calculations validate inputs',async()=>{
 const db=new DatabaseSync(':memory:'),otherDb=new DatabaseSync(':memory:'),store=businessExpertise(db),other=businessExpertise(otherDb);
 const call=role=>store.handle({method:'PUT',jobscopesActor:{role}},new URL('http://localhost/api/business-expertise'),async()=>({profession:'Carpenter',specialties:'Decks and framing'}),()=>{});
 await assert.rejects(call('Viewer'),e=>e.status===403);await assert.rejects(call('Manager'),e=>e.status===403);await call('Owner');assert.match(store.context(),/Carpenter/);assert.equal(other.context(),'');
 assert.equal(quickCost({materials:'1,000',hours:'10',rate:'50',other:'100',contingency:'10'}).total,1760);
 assert.throws(()=>quickCost({materials:'',hours:'10',rate:'50',other:'0',contingency:'10'}));
 assert.throws(()=>quickCost({materials:'100',hours:'-1',rate:'50',other:'0',contingency:'10'}));
 db.close();otherDb.close();
});

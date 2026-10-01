import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {billingStore} from '../billing.mjs';
import {paidUsage} from '../paid-usage.mjs';
import {aiBudget,astraCostMicros} from '../ai-budget.mjs';
import {cloudAdapter} from '../cloud-analysis.mjs';
import {DatabaseSync} from 'node:sqlite';
import {analysisStore} from '../analysis.mjs';

test('customer credits settle only after saved results and refund failures',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'paid-usage-')),credits=billingStore(dir),run=paidUsage(credits,'a');
 t.after(()=>{credits.close();rmSync(dir,{recursive:true,force:true});});
 credits.grant({id:'invoice',company:'a',amount:2,expires:Date.now()+100000});
 await assert.rejects(run('analysis','failed',async()=>{assert.equal(credits.balance('a'),1);throw new Error('save failed');}),/save failed/);
 assert.equal(credits.balance('a'),2);
 let saved=false;await run('analysis','saved',async()=>{saved=true;return {id:'result'};});
 assert.ok(saved);assert.equal(credits.balance('a'),1);
 await assert.rejects(run('analysis','saved',()=>assert.fail('must not call provider twice')),{status:409});
 await assert.rejects(paidUsage(credits,'b')('analysis','other',()=>assert.fail('cross-company credit')),{status:429});
 await assert.rejects(run('joe','joe',()=>assert.fail('analysis credit cannot fund Joe')),{status:429});
});

test('monthly spending holds uncertain calls across restart and settles once',t=>{
 const dir=mkdtempSync(join(tmpdir(),'ai-budget-'));let now=Date.UTC(2026,9,1),budget=aiBudget(dir,{now:()=>now});
 t.after(()=>{budget.close();rmSync(dir,{recursive:true,force:true});});
 assert.equal(astraCostMicros({input_tokens:5000,output_tokens:1000}),100000);
 assert.equal(astraCostMicros({input_tokens:-1,output_tokens:0}),null);
 for(let i=0;i<8;i++)budget.reserve('call'+i);
 assert.equal(budget.status().estimated_used_usd,24);assert.equal(budget.status().alert,true);
 assert.throws(()=>budget.reserve('excess'),{status:429});
 budget.settle('call0',{input_tokens:5000,output_tokens:1000});
 budget.settle('call0',{input_tokens:5000,output_tokens:1000});
 assert.equal(budget.status().estimated_used_usd,21.1);
 budget.close();budget=aiBudget(dir,{now:()=>now});assert.equal(budget.status().estimated_used_usd,21.1);
 assert.throws(()=>budget.reserve('call1'),{status:409});
 now=Date.UTC(2026,10,1);assert.equal(budget.status().estimated_used_usd,0);
 budget.settle('call1',{input_tokens:100,output_tokens:100});assert.equal(budget.status().estimated_used_usd,0);
});

test('paid photo path refunds invalid output, settles persisted output, and reuses saved results',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'paid-photo-')),credits=billingStore(dir),db=new DatabaseSync(':memory:');
 t.after(()=>{db.close();credits.close();rmSync(dir,{recursive:true,force:true});});
 db.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY);INSERT INTO projects VALUES('a');CREATE TABLE photos(id TEXT PRIMARY KEY,project_id TEXT,content BLOB);INSERT INTO photos VALUES('photo','a',X'0102');CREATE TABLE operations_records(id TEXT PRIMARY KEY,project_id TEXT,kind TEXT,data TEXT,revision INTEGER,created_at TEXT,updated_at TEXT);`);
 credits.grant({id:'paid',company:'company',amount:25,expires:Date.now()+100000});let valid=false,calls=0;
 const store=analysisStore(db,{cloud:{status:()=>({}),runSaved:paidUsage(credits,'company'),analyze:async()=>{calls++;return valid?{summary:'Draft',findings:[]}:{summary:'Invalid',findings:[{}]};}}});
 const run=()=>store.handle({method:'POST',jobscopesActor:{role:'Owner'}},new URL('https://example.test/api/projects/a/analysis'),()=>{},async()=>({photo_id:'photo',provider:'openai',cloud_consent:true}),()=>{});
 await assert.rejects(run());assert.equal(credits.balance('company'),25);
 valid=true;await run();assert.equal(credits.balance('company'),24);assert.equal(db.prepare('SELECT count(*) n FROM photo_analyses').get().n,1);
 await run();assert.equal(calls,2);assert.equal(credits.balance('company'),24);
});

test('provider budget meters paid calls separately without enabling pilot spending',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'paid-provider-')),budget=aiBudget(dir);let calls=0;
 const adapter=cloudAdapter({dataDir:dir,maxAttempts:0,budget,unlock:async()=> 'test',prepare:async()=> 'test',request:async()=>{calls++;return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:5000,output_tokens:1000},output:[{type:'message',content:[{type:'output_text',text:'{"summary":"Draft","findings":[]}'}]}]})};}});
 t.after(()=>{adapter.close();budget.close();rmSync(dir,{recursive:true,force:true});});
 await adapter.analyze(Buffer.from('x'),'','prompt',{});assert.equal(calls,1);assert.equal(budget.status().estimated_used_usd,.1);
 assert.equal(adapter.status().remaining_attempts,0);
});

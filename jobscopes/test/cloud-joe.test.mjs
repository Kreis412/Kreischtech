import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cloudAdapter} from '../cloud-analysis.mjs';
test('hosted Joe shares photo quota, bounds output, and blocks duplicate paid submissions across restart',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'cs-joe-cloud-'));let cloud,calls=0;const options={dataDir:dir,maxAttempts:2,unlock:async()=>'fake-secret',prepare:async()=>'fake-image',request:async(url,opts)=>{
  calls++;const body=JSON.parse(opts.body);assert.equal(body.store,false);assert.equal(opts.redirect,'error');assert.equal(body.max_output_tokens,1600);assert.equal(body.tools,undefined);assert.equal(body.input.at(-1).content,'What should I record?');assert.equal(body.input[0].content,'No project context supplied.');
  return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'Record the observed condition and next step.'}]}]})};
 }};t.after(()=>{cloud.close();rmSync(dir,{recursive:true,force:true});});
 cloud=cloudAdapter(options);assert.match(await cloud.chat([{role:'user',content:'What should I record?'}],null,'company:user:question'),/observed/);
 cloud.close();cloud=cloudAdapter(options);assert.equal(cloud.status().remaining_attempts,1);
 await assert.rejects(()=>cloud.chat([{role:'user',content:'What should I record?'}],null,'company:user:question'),e=>e.status===409);assert.equal(calls,1);
 await cloud.chat([{role:'user',content:'What should I record?'}],null,'company:user:question2');
 await assert.rejects(()=>cloud.analyze(Buffer.from('x'),'','',{}),e=>e.status===429);assert.equal(calls,2);
});
test('uncertain cloud chat consumes one attempt without automatic retry; zero quota sends nothing',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'cs-joe-fail-'));let calls=0;let cloud=cloudAdapter({dataDir:dir,maxAttempts:0,unlock:async()=>'fake',request:async()=>{calls++;throw Error('network');}});
 t.after(()=>{cloud.close();rmSync(dir,{recursive:true,force:true});});
 await assert.rejects(()=>cloud.chat([],null,'key'),e=>e.status===429);assert.equal(calls,0);cloud.close();
 cloud=cloudAdapter({dataDir:dir,maxAttempts:1,unlock:async()=>'fake',request:async()=>{calls++;throw Error('network');}});
 await assert.rejects(()=>cloud.chat([],null,'key'),e=>e.status===503);assert.equal(calls,1);assert.equal(cloud.status().remaining_attempts,0);
 await assert.rejects(()=>cloud.chat([],null,'key'),e=>e.status===409);assert.equal(calls,1);
});

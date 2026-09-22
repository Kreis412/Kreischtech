import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cloudAdapter} from '../cloud-analysis.mjs';
test('cloud pilot reserves before sending, survives restart, limits attempts and avoids retries',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'jobscopes-cloud-'));let calls=0;
 const options={dataDir:dir,unlock:async()=> 'fake-key',prepare:async()=> 'fake-image',request:async(url,o)=>{calls++;const b=JSON.parse(o.body);assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(b.store,false);assert.equal(b.max_output_tokens,2400);assert.equal(b.input.length,1);assert.equal(o.redirect,'error');return {ok:true,json:async()=>({status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:'{"summary":"test","findings":[]}'}]}]})};}};
 let c=cloudAdapter(options);try{await c.analyze(Buffer.from('x'),'','prompt',{});c.close();c=cloudAdapter(options);assert.equal(c.status().remaining_attempts,4);for(let i=0;i<4;i++)await c.analyze(Buffer.from('x'),'','prompt',{});await assert.rejects(c.analyze(Buffer.from('x'),'','prompt',{}),e=>e.status===429);assert.equal(calls,5);}finally{c.close();rmSync(dir,{recursive:true,force:true});}
});
test('network uncertainty keeps a reservation and does not retry',async()=>{const dir=mkdtempSync(join(tmpdir(),'jobscopes-cloud-'));let calls=0;const c=cloudAdapter({dataDir:dir,unlock:async()=> 'fake',prepare:async()=> 'fake',request:async()=>{calls++;throw Error('network');}});try{await assert.rejects(c.analyze(Buffer.from('x'),'','prompt',{}),e=>e.status===503);assert.equal(calls,1);assert.equal(c.status().remaining_attempts,4);}finally{c.close();rmSync(dir,{recursive:true,force:true});}});

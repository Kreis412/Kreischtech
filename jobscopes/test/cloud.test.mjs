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

test('authorized limit increase preserves prior usage across restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'jobscopes-allowance-'));
 const options={dataDir:dir,unlock:async()=> 'fake',prepare:async()=> 'fake',request:async()=>{throw Error('simulated request failure');}};
 let c=cloudAdapter({...options,maxAttempts:2});
 try{
  for(let i=0;i<2;i++)await assert.rejects(c.analyze(Buffer.from('x'),'','',{}));
  assert.equal(c.status().remaining_attempts,0);c.close();
  c=cloudAdapter({...options,maxAttempts:22});assert.equal(c.status().remaining_attempts,20);
 }finally{c.close();rmSync(dir,{recursive:true,force:true});}
});

test('text scan analysis sends text without image preparation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'text-scan-'));let prepared=false;
 const c=cloudAdapter({dataDir:dir,unlock:async()=> 'fake',prepare:async()=>{prepared=true;throw Error('unexpected');},request:async(url,o)=>{const b=JSON.parse(o.body);assert.deepEqual(b.input[0].content.map(x=>x.type),['input_text']);assert.match(b.input[0].content[0].text,/P0300/);return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"summary":"test","findings":[]}'}]}]})};}});
 try{await c.analyze(null,'P0300','scan',{});assert.equal(prepared,false);}finally{c.close();rmSync(dir,{recursive:true,force:true});}
});

test('multiple scan frames are separate images in one provider request',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'scan-frames-'));let calls=0;
 const c=cloudAdapter({dataDir:dir,unlock:async()=> 'fake',prepare:async b=>b.toString('base64'),request:async(url,o)=>{calls++;const b=JSON.parse(o.body);assert.equal(b.input[0].content.filter(x=>x.type==='input_image').length,2);return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"summary":"test","findings":[]}'}]}]})};}});
 try{await c.analyze([Buffer.from('a'),Buffer.from('b')],'frames','scan',{});assert.equal(calls,1);await assert.rejects(c.analyze(Array(7).fill(Buffer.from('a')),'','',{}),e=>e.status===400);assert.equal(calls,1);}finally{c.close();rmSync(dir,{recursive:true,force:true});}
});

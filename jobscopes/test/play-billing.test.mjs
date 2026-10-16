import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {playBilling} from '../play-billing.mjs';
const owner={role:'Owner',user_id:'alice',company_id:'company-a'};
function fixture(t){
 const dataDir=mkdtempSync(join(tmpdir(),'cs-play-'));let time=Date.now(),consumeFailure=false;
 const purchases=new Map();let consumes=0;
 const client={get:async(id,token)=>{const p=purchases.get(token);if(!p)throw Error('Invalid token');return {...p,productId:id};},consume:async(id,token)=>{consumes++;if(consumeFailure)throw Error('offline');purchases.get(token).consumptionState=1;}};
 let service=playBilling({dataDir,client,enabled:true,now:()=>time});
 t.after(()=>{service.close();rmSync(dataDir,{force:true,recursive:true});});
 return {get service(){return service;},purchases,add:(token,extra={})=>purchases.set(token,{purchaseState:0,consumptionState:0,...extra}),setFailure:v=>consumeFailure=v,advance:ms=>time+=ms,get consumes(){return consumes;},restart:()=>{service.close();service=playBilling({dataDir,client,enabled:true,now:()=>time});}};
}
test('all packs grant once, survive restart and carry over; duplicate and foreign claims are rejected',async t=>{
 const f=fixture(t);
 for(const [id,amount] of [['analysis_1',1],['analysis_5',5],['analysis_12',12]]){
  const token='token-'+id;f.add(token);await Promise.all([f.service.confirm(owner,id,token),f.service.confirm(owner,id,token)]);
 }
 assert.equal(f.service.status(owner).balance,18);assert.equal(f.consumes,3);assert.equal(f.service.status(owner).joe_balance,0);
 f.restart();f.advance(400*86400000);assert.equal(f.service.status(owner).balance,18);
 await assert.rejects(f.service.confirm({...owner,company_id:'other'},'analysis_1','token-analysis_1'),{status:409});
 await assert.rejects(f.service.confirm({...owner,user_id:'other'},'analysis_1','token-analysis_1'),{status:409});
 await assert.rejects(f.service.confirm({...owner,role:'Member'},'analysis_1','token-analysis_1'),{status:403});
});
test('pending, canceled, test and already-consumed unclaimed purchases cannot issue credits',async t=>{
 const f=fixture(t);f.add('pending-token',{purchaseState:2});assert.equal((await f.service.confirm(owner,'analysis_12','pending-token')).pending,true);
 for(const [token,extra] of [['cancel-token',{purchaseState:1}],['test-token-0',{purchaseType:0}],['consumed-token',{consumptionState:1}]]){f.add(token,extra);await assert.rejects(f.service.confirm(owner,'analysis_12',token));}
 assert.equal(f.service.status(owner).balance,0);assert.equal(f.consumes,0);
});
test('lost consume response retries safely and refund removes only its own remaining credits',async t=>{
 const f=fixture(t);f.add('retry-token');f.setFailure(true);
 await assert.rejects(f.service.confirm(owner,'analysis_5','retry-token'));assert.equal(f.service.status(owner).balance,5);
 f.restart();f.setFailure(false);await f.service.confirm(owner,'analysis_5','retry-token');assert.equal(f.service.status(owner).balance,5);
 const run=f.service.runSaved(owner.company_id);await run('analysis','completed',async()=>({saved:true}));
 await assert.rejects(run('analysis','failed',async()=>{throw Error('generation failed');}));assert.equal(f.service.status(owner).balance,4);
 f.add('other-token');await f.service.confirm(owner,'analysis_12','other-token');
 f.purchases.get('retry-token').purchaseState=1;await f.service.reconcile(owner.company_id,true);assert.equal(f.service.status(owner).balance,12);
});

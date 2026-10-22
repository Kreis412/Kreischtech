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

function subscriptionFixture(t){
 const dataDir=mkdtempSync(join(tmpdir(),'cs-play-sub-'));let time=Date.now(),acks=0,failAck=false;
 const purchases=new Map(),products={solo:'contractorsight_solo',pro:'contractorsight_pro',team:'contractorsight_team'};
 const client={subscription:async token=>structuredClone(purchases.get(token)),acknowledge:async()=>{acks++;if(failAck)throw Error('offline');}};
 const options={dataDir,client,enabled:true,products,now:()=>time};let service=playBilling(options);
 t.after(()=>{service.close();rmSync(dataDir,{force:true,recursive:true});});
 return {get service(){return service;},purchases,options,get acks(){return acks;},failAck:v=>failAck=v,advance:ms=>time+=ms,restart(){service.close();service=playBilling(options);},add(token,plan='team',extra={}){purchases.set(token,{subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',lineItems:[{productId:products[plan],offerDetails:{basePlanId:'monthly'},expiryTime:new Date(time+30*86400000).toISOString(),latestSuccessfulOrderId:'order-'+token}],...extra});}};
}
test('Play Team grants once, restores after acknowledgement failure and expires monthly credits',async t=>{
 const f=subscriptionFixture(t);f.add('team-token-001');f.failAck(true);
 await assert.rejects(f.service.confirm(owner,'contractorsight_team','team-token-001'));
 assert.equal(f.service.status(owner).balance,150);assert.equal(f.service.status(owner).joe_balance,250);
 f.failAck(false);f.restart();await f.service.confirm(owner,'contractorsight_team','team-token-001');
 assert.equal(f.service.status(owner).balance,150);assert.equal(f.service.seatLimit(owner.company_id),5);
 await f.service.runSaved(owner.company_id)('analysis','photo1',async()=>true);
 await f.service.confirm(owner,'contractorsight_team','team-token-001');assert.equal(f.service.status(owner).balance,149);
 await assert.rejects(f.service.confirm({...owner,company_id:'other'},'contractorsight_team','team-token-001'),{status:409});
 f.advance(31*86400000);assert.equal(f.service.status(owner).balance,0);assert.equal(f.service.seatLimit(owner.company_id),1);
});
test('Play renewals replace monthly balances; cancellation keeps paid access and revocation removes it',async t=>{
 const f=subscriptionFixture(t);f.add('pro-token-001','pro');await f.service.confirm(owner,'contractorsight_pro','pro-token-001');
 await f.service.runSaved(owner.company_id)('joe','q1',async()=>true);
 const p=f.purchases.get('pro-token-001');p.lineItems[0].latestSuccessfulOrderId='renewal-001';p.lineItems[0].expiryTime=new Date(Date.parse(p.lineItems[0].expiryTime)+30*86400000).toISOString();
 await f.service.reconcile(owner.company_id,true);assert.equal(f.service.status(owner).balance,75);assert.equal(f.service.status(owner).joe_balance,100);
 p.subscriptionState='SUBSCRIPTION_STATE_CANCELED';await f.service.reconcile(owner.company_id,true);assert.equal(f.service.status(owner).balance,75);
 p.subscriptionState='SUBSCRIPTION_STATE_EXPIRED';await f.service.reconcile(owner.company_id,true);assert.equal(f.service.status(owner).balance,0);assert.equal(f.service.status(owner).joe_balance,0);
});
test('Play rejects unverified, mismatched, duplicate, test and oversized subscriptions',async t=>{
 const f=subscriptionFixture(t);f.add('pending-token-1','pro',{subscriptionState:'SUBSCRIPTION_STATE_PENDING'});
 assert.equal((await f.service.confirm(owner,'contractorsight_pro','pending-token-1')).pending,true);assert.equal(f.service.status(owner).balance,0);
 f.add('test-token-001','pro',{testPurchase:{}});await assert.rejects(f.service.confirm(owner,'contractorsight_pro','test-token-001'),{status:400});
 f.add('wrong-token-001','pro');await assert.rejects(f.service.confirm(owner,'contractorsight_team','wrong-token-001'),{status:409});
 f.add('team-token-001');await f.service.confirm(owner,'contractorsight_team','team-token-001');f.add('team-token-002');await assert.rejects(f.service.confirm(owner,'contractorsight_team','team-token-002'),{status:409});
 assert.equal(f.service.status(owner).balance,150);
 f.options.memberCount=()=>6;f.restart();f.add('team-token-003');await assert.rejects(f.service.confirm({...owner,company_id:'six'},'contractorsight_team','team-token-003'),{status:409});
});

test('Play deferred replacement transfers current credits without resetting usage, then grants the paid new period',async t=>{
 const f=subscriptionFixture(t);f.add('solo-original','solo');await f.service.confirm(owner,'contractorsight_solo','solo-original');
 await f.service.runSaved(owner.company_id)('analysis','used-photo',async()=>true);
 await f.service.runSaved(owner.company_id)('joe','used-answer',async()=>true);
 const preview=await f.service.prepareChange(owner,'contractorsight_team');
 assert.equal(preview.replacement.prorationMode,'deferred');assert.equal(preview.replacement.purchaseToken,'solo-original');
 assert.equal(f.service.status(owner).balance,24);
 const old=structuredClone(f.purchases.get('solo-original').lineItems[0]);old.deferredItemReplacement={productId:'contractorsight_team'};
 f.add('team-replacement','team',{linkedPurchaseToken:'solo-original',lineItems:[old,{productId:'contractorsight_team',offerDetails:{basePlanId:'monthly'}}]});
 f.failAck(true);await assert.rejects(f.service.confirm(owner,'contractorsight_team','team-replacement'));
 f.failAck(false);f.restart();const result=await f.service.confirm(owner,'contractorsight_team','team-replacement');
 assert.equal(result.scheduled,true);assert.equal(f.service.status(owner).balance,24);assert.equal(f.service.status(owner).joe_balance,24);assert.equal(f.service.seatLimit(owner.company_id),1);
 assert.equal(f.service.status(owner).scheduled_change.plan,'team');
 await assert.rejects(f.service.prepareChange({...owner,user_id:'other'},'contractorsight_pro'),{status:409});
 await assert.rejects(f.service.prepareChange(owner,'contractorsight_pro'),{status:409});
 await assert.rejects(f.service.confirm({...owner,company_id:'other'},'contractorsight_team','team-replacement'),{status:409});
 const purchase=f.purchases.get('team-replacement');delete purchase.lineItems[0].deferredItemReplacement;
 purchase.lineItems[1].expiryTime=new Date(Date.parse(old.expiryTime)+30*86400000).toISOString();purchase.lineItems[1].latestSuccessfulOrderId='team-renewal';
 f.advance(31*86400000);await f.service.reconcile(owner.company_id,true);
 assert.equal(f.service.status(owner).balance,150);assert.equal(f.service.status(owner).joe_balance,250);assert.equal(f.service.seatLimit(owner.company_id),5);assert.equal(f.service.status(owner).scheduled_change,null);
 await f.service.reconcile(owner.company_id,true);assert.equal(f.service.status(owner).balance,150);
});

test('Play rejects invalid replacements before touching the paid balance and blocks oversized downgrades',async t=>{
 const f=subscriptionFixture(t);f.add('team-original','team');await f.service.confirm(owner,'contractorsight_team','team-original');
 f.options.memberCount=()=>3;f.restart();await assert.rejects(f.service.prepareChange(owner,'contractorsight_solo'),{status:409});
 f.add('invalid-replace','pro',{linkedPurchaseToken:'team-original',lineItems:[{productId:'contractorsight_pro',offerDetails:{basePlanId:'monthly'},expiryTime:'bad'}]});
 await assert.rejects(f.service.confirm(owner,'contractorsight_pro','invalid-replace'));assert.equal(f.service.status(owner).balance,150);assert.equal(f.service.seatLimit(owner.company_id),5);
});

test('Play scheduled downgrade retains current credits and canceled renewal does not award future credits',async t=>{
 const f=subscriptionFixture(t);f.add('team-first','team');await f.service.confirm(owner,'contractorsight_team','team-first');
 const old=structuredClone(f.purchases.get('team-first').lineItems[0]);old.deferredItemReplacement={productId:'contractorsight_solo'};
 f.add('solo-later','solo',{linkedPurchaseToken:'team-first',lineItems:[old,{productId:'contractorsight_solo',offerDetails:{basePlanId:'monthly'}}]});
 await f.service.confirm(owner,'contractorsight_solo','solo-later');assert.equal(f.service.status(owner).balance,150);assert.equal(f.service.seatLimit(owner.company_id),1);
 assert.equal((await f.service.confirm(owner,'contractorsight_team','team-first')).superseded,true);
 const p=f.purchases.get('solo-later');p.subscriptionState='SUBSCRIPTION_STATE_CANCELED';p.lineItems=[{...old}];delete p.lineItems[0].deferredItemReplacement;
 await f.service.reconcile(owner.company_id,true);assert.equal(f.service.status(owner).balance,150);assert.equal(f.service.status(owner).scheduled_change,null);
 f.advance(31*86400000);p.subscriptionState='SUBSCRIPTION_STATE_EXPIRED';await f.service.reconcile(owner.company_id,true);assert.equal(f.service.status(owner).balance,0);assert.equal(f.service.status(owner).joe_balance,0);
});

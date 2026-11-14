import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openStore,createHandler,termsVersion} from '../app.mjs';

test('customer ratings are public, editable, owner protected, reportable and deleted with the account',async()=>{
 const store=await openStore({directory:mkdtempSync(join(tmpdir(),'branche-reviews-'))});
 const server=createServer(createHandler(store,{operationsOptions:{deleteFile:async()=>{}}}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 const call=async(path,body,cookie='',method=body?'POST':'GET')=>{const r=await fetch(base+'/api/branche/'+path,{method,headers:{cookie,origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 try{
  const reg=(name,role)=>call('register',{name,email:name+'@example.test',password:'test-only-password',role,terms:termsVersion});
  const owner=await reg('Owner','contractor'),customer=await reg('Customer','customer'),other=await reg('Other','customer');
  const contractor=owner.data.user.id;
  const review={contractor,rating:5,body:'Worked on our deck and kept us informed.'};
  assert.equal((await call('reviews',review,customer.cookie)).status,404);
  const profile={name:'Deck Builder',contact:'Owner',category:'Carpentry',city:'Mentor',region:'Lake County',description:'Deck repairs and builds',services:'Decks',published:true};
  assert.equal((await call('profile',profile,owner.cookie,'PUT')).status,200);
  assert.equal((await call('reviews',review,owner.cookie)).status,403);
  assert.equal((await call('reviews',{...review,rating:6},customer.cookie)).status,400);
  assert.equal((await call('reviews',review,customer.cookie)).status,200);
  assert.equal((await call('reviews',{...review,rating:3,body:'Updated after follow-up.'},customer.cookie)).status,200);
  const listing=(await call('reviews?contractor='+contractor)).data.reviews;
  assert.equal(listing.length,1);assert.equal(listing[0].rating,3);assert.equal(listing[0].name,'Customer');
  assert.equal((await call('report',{kind:'review',target:listing[0].id,reason:'Concern about accuracy'},other.cookie)).status,201);
  assert.equal((await call('account-delete',{password:'test-only-password'},customer.cookie)).status,200);
  assert.equal((await call('reviews?contractor='+contractor)).data.reviews.length,0);
  assert.equal((await store.query("SELECT id FROM branche_reports WHERE kind='review'")).length,0);
 }finally{await new Promise(r=>server.close(r));await store.close();}
});

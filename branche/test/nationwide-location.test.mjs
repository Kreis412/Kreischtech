import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {start} from '../server.mjs';
import {termsVersion} from '../app.mjs';

test('businesses, jobs and posts retain distinct U.S. states across restart',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'branche-states-'));
 let app=await start({directory,port:0});
 let base='http://127.0.0.1:'+app.server.address().port;
 const call=async(path,body,cookie='',method=body?'POST':'GET')=>{
  const response=await fetch(base+'/api/branche/'+path,{method,headers:{cookie,origin:base,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
 };
 try{
  const states=(await call('session')).data.states;
  assert.equal(states.CA,'California');assert.equal(states.NY,'New York');assert.equal(states.OH,'Ohio');
  const business=await call('register',{name:'Contractor',email:'contractor@example.test',password:'test-only-passphrase',role:'contractor',terms:termsVersion});
  const customer=await call('register',{name:'Customer',email:'customer@example.test',password:'test-only-passphrase',role:'customer',terms:termsVersion});
  const profile={name:'Coast Carpentry',contact:'Owner',category:'Carpentry',city:'Springfield',state_code:'CA',region:'Local area',description:'Test business',services:'Decks',published:true};
  assert.equal((await call('profile',profile,business.cookie,'PUT')).status,200);
  assert.equal((await call('profiles')).data.profiles[0].state_code,'CA');
  assert.equal((await call('profile',{...profile,state_code:'ZZ'},business.cookie,'PUT')).status,400);
  assert.equal((await call('jobs',{title:'Repair deck',category:'Carpentry',city:'Springfield',state_code:'NY',description:'Test request',timing:'Flexible'},customer.cookie)).status,201);
  assert.equal((await call('posts',{title:'Project update',category:'Carpentry',city:'Springfield',state_code:'TX',description:'Test update'},business.cookie)).status,201);
  assert.equal((await call('jobs')).data.jobs[0].state_code,'NY');
  assert.equal((await call('posts')).data.posts[0].state_code,'TX');
  assert.equal((await call('profiles?state=CA')).data.profiles.length,1);
  assert.equal((await call('profiles?state=NY')).data.profiles.length,0);
  assert.equal((await call('jobs?state=NY')).data.jobs.length,1);
  assert.equal((await call('jobs?state=CA')).data.jobs.length,0);
  assert.equal((await call('posts?state=TX')).data.posts.length,1);
  assert.equal((await call('posts?state=CA')).data.posts.length,0);
  assert.equal((await call('profiles?state=ZZ')).status,400);
  assert.equal((await call('public-profile?uid='+business.data.user.id)).data.profile.state_code,'CA');
  await app.close();app=await start({directory,port:0});base='http://127.0.0.1:'+app.server.address().port;
  assert.equal((await call('profiles')).data.profiles[0].state_code,'CA');
  assert.equal((await call('jobs')).data.jobs[0].state_code,'NY');
  assert.equal((await call('posts')).data.posts[0].state_code,'TX');
 }finally{await app.close();rmSync(directory,{recursive:true,force:true});}
});

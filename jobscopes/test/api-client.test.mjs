import {test} from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../public/api.js';
test('API client handles HTML interruptions without replaying project writes', async t=>{
 let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response('<!DOCTYPE html><h1>Unavailable</h1>',{status:502,headers:{'content-type':'text/html'}});});
 await assert.rejects(api('/api/projects',{method:'POST',body:'{}'}),/entries are still.*avoid duplicates/);
 assert.equal(calls,1);
 await assert.rejects(api('/api/projects'),/HTTP 502.*try again/);
});
test('API client preserves JSON validation and successful project responses',async t=>{
 const fetch=t.mock.method(globalThis,'fetch',async()=>Response.json({error:'Enter a project name.'},{status:400}));
 await assert.rejects(api('/api/projects',{method:'POST'}),/Enter a project name/);
 fetch.mock.mockImplementation(async()=>Response.json({id:'saved-project'},{status:201}));
 assert.deepEqual(await api('/api/projects',{method:'POST'}),{id:'saved-project'});
 fetch.mock.mockImplementation(async()=>new Response('<!DOCTYPE html>',{headers:{'content-type':'application/json'}}));
 await assert.rejects(api('/api/projects'),/unexpected response/);
});

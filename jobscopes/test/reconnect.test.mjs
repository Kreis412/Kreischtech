import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const resume=source.slice(source.indexOf('let uploadingPhotos=false;'),source.indexOf('async function showPendingPhotos'));
test('reconnect uploads queued photos serially once and refreshes the same project',async()=>{
 let sends=0,refreshes=0,active=0,maxActive=0;
 const context=vm.createContext({navigator:{onLine:true},current:{id:'project'},account:{getSession:()=>({user:{email:'owner'},company:{id:'company'}})},pendingPhotos:async(...args)=>{assert.deepEqual(args,['owner','company','project']);return [{id:1},{id:2}];},sendPhoto:async()=>{sends++;active++;maxActive=Math.max(maxActive,active);await new Promise(r=>setTimeout(r,5));active--;},api:async()=>({id:'project'}),projectView:()=>refreshes++,toast:()=>{},showPendingPhotos:()=>{},AbortSignal,window:{addEventListener:()=>{}}});
 vm.runInContext(resume,context);
 await Promise.all([vm.runInContext('resumePendingPhotos()',context),vm.runInContext('resumePendingPhotos()',context)]);
 assert.equal(sends,2);assert.equal(maxActive,1);assert.equal(refreshes,1);
 context.navigator.onLine=false;await vm.runInContext('resumePendingPhotos()',context);assert.equal(sends,2);
 context.navigator.onLine=true;context.sendPhoto=async()=>{sends++;throw Error('offline again');};await vm.runInContext('resumePendingPhotos()',context);assert.equal(sends,3);
});

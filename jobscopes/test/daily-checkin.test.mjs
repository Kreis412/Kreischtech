import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {dailyCheckin,checkinKey,checkinSettings,localDay} from '../public/daily-checkin.js';
import {weatherService} from '../weather.mjs';
test('check-in is daily, account scoped, optional and does not request location or finances for viewers',t=>{
 const dom=new JSDOM('<main></main>',{url:'https://example.com'});for(const k of ['document','localStorage']){const old=globalThis[k];globalThis[k]=dom.window[k];t.after(()=>{globalThis[k]=old;});}t.after(()=>dom.window.close());
 const host=document.querySelector('main'),session={company:{id:'a'},user:{email:'one@example.com'}},calls=[];
 const args={session,projects:[],role:'Viewer',api:path=>{calls.push(path);return Promise.resolve({});},esc:s=>String(s).replaceAll('<','&lt;')};
 dailyCheckin(host,args);assert.equal(host.querySelectorAll('.daily-checkin').length,1);assert.deepEqual(calls,[]);
 const f=host.querySelector('form');f.elements.task.value='Order lumber';f.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));assert.match(localStorage.getItem(checkinKey(session)+':tasks'),/Order lumber/);
 host.innerHTML='';dailyCheckin(host,args);assert.equal(host.children.length,0);
 dailyCheckin(host,{...args,force:true});assert.match(host.textContent,/Order lumber/);
 host.innerHTML='';dailyCheckin(host,{...args,session:{...session,user:{email:'two@example.com'}}});assert.doesNotMatch(host.textContent,/Order lumber/);
 checkinSettings(host,{session});const toggle=host.querySelector('input');toggle.checked=false;toggle.onchange();localStorage.removeItem(checkinKey(session)+':day');host.innerHTML='';dailyCheckin(host,args);assert.equal(host.children.length,0);assert.equal(localDay(new Date(2026,0,2)),'2026-1-2');
});
test('weather validates coordinates, rounds, caches and identifies itself without forwarding user identity',async()=>{
 let count=0;const weather=weatherService({now:()=>1792620000000,request:async(url,options)=>{count++;assert.match(url,/lat=41.12&lon=-81.13/);assert.match(options.headers['User-Agent'],/kreischtech@gmail.com/);assert.doesNotMatch(JSON.stringify(options),/private-user/);return new Response(JSON.stringify({properties:{meta:{updated_at:'2026-10-21T20:00:00Z'},timeseries:[{time:'2026-10-22T00:00:00Z',data:{instant:{details:{air_temperature:15,wind_speed:2}},next_1_hours:{summary:{symbol_code:'cloudy'},details:{precipitation_amount:0}}}}]}}),{headers:{expires:'Thu, 22 Oct 2026 10:00:00 GMT'}});}});
 await assert.rejects(()=>weather('private-user',null,1),{status:400});const first=await weather('private-user',41.1234,-81.129);assert.equal(first.temperature_c,15);assert.deepEqual(await weather('another-user',41.1234,-81.129),first);assert.equal(count,1);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {playBillingView} from '../public/play-billing.js';
import {joeUI} from '../public/joe.js';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function browser(t){const dom=new JSDOM('<body data-signed-in="true"><main></main></body>',{url:'https://example.com/#company'});for(const key of ['window','document','location','localStorage']){const old=globalThis[key];globalThis[key]=dom.window[key];t.after(()=>{if(old===undefined)delete globalThis[key];else globalThis[key]=old;});}t.after(()=>dom.window.close());return dom.window.document.querySelector('main');}
test('Joe dismissal applies across pages and refreshes until the next local day; manual Joe remains',t=>{
 browser(t);localStorage.setItem('jobscopes-joe-suggestions','on');const ui=joeUI({esc});ui.widgets(null);
 assert.ok(document.querySelector('.joe-suggestion'));document.querySelector('[data-joe-dismiss]').click();
 location.hash='#projects';ui.widgets({id:'a',photos:[]});assert.equal(document.querySelector('.joe-suggestion'),null);assert.ok(document.querySelector('a[href="#joe/a"]'));
 document.querySelector('.joe-widget').remove();joeUI({esc}).widgets(null);assert.equal(document.querySelector('.joe-suggestion'),null);
 const until=Number(localStorage.getItem('jobscopes-joe-dismissed-until'));assert.equal(new Date(until).getHours(),0);
 const oldNow=Date.now;Date.now=()=>until+1;t.after(()=>{Date.now=oldNow;});ui.widgets(null);assert.ok(document.querySelector('.joe-suggestion'));
});
test('Play UI displays store price, verifies before completing, and restores pending purchases',async t=>{
 const host=browser(t),calls=[],complete=[];let balance=0;
 const product={itemId:'analysis_5',title:'5 analyses',price:{currency:'USD',value:'4.99'}};
 window.getDigitalGoodsService=async()=>({getDetails:async()=>[product],listPurchases:async()=>[{itemId:'analysis_5',purchaseToken:'pending-token'}]});
 const old=globalThis.PaymentRequest;globalThis.PaymentRequest=class{constructor(methods){assert.equal(methods[0].data.sku,'analysis_5');}async show(){return {details:{purchaseToken:'verified-token'},complete:async value=>complete.push(value)};}};t.after(()=>{globalThis.PaymentRequest=old;});
 const api=async(path,options)=>{calls.push(path);if(path.endsWith('/confirm')){const b=JSON.parse(options.body);if(b.token==='pending-token')return {pending:true};balance=5;return {confirmed:true,balance};}return {ready:true,purchase_enabled:true,balance,joe_balance:0,packs:[{id:'analysis_5',name:'5 photo analyses',analyses:5}]};};
 await playBillingView(host,{api,esc});assert.match(host.textContent,/\$4.99/);
 await host.querySelector('[data-buy]').onclick();assert.deepEqual(complete,['success']);assert.match(host.textContent,/5 photo analyses remaining/);
 await host.querySelector('[data-restore]').onclick();assert.match(host.textContent,/payment is still pending/);assert.ok(calls.includes('/api/billing/play/sync'));
});
test('Play UI never offers a purchase when server or device cannot verify it',async t=>{
 const host=browser(t);await playBillingView(host,{esc,api:async()=>({ready:false,purchase_enabled:false,balance:2,joe_balance:0})});assert.equal(host.querySelector('[data-buy]'),null);
 await playBillingView(host,{esc,api:async()=>({ready:true,purchase_enabled:true,balance:2,joe_balance:0,packs:[]})});assert.equal(host.querySelector('[data-buy]'),null);assert.match(host.textContent,/latest ContractorSight app/);
});

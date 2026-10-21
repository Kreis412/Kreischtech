import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {playBillingView} from '../public/play-billing.js';
import {joeUI} from '../public/joe.js';
import {billingView} from '../public/billing.js';
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
 await host.querySelector('[data-buy]').onclick();assert.deepEqual(complete,[]);assert.equal(host.querySelector('[data-buy]').textContent,'Continue in Google Play');
 await host.querySelector('[data-buy]').onclick();assert.deepEqual(complete,['success']);assert.match(host.textContent,/5 photo analyses remaining/);
 await host.querySelector('[data-restore]').onclick();assert.match(host.textContent,/payment is still pending/);assert.ok(calls.includes('/api/billing/play/sync'));
});
test('Play UI never offers a purchase when server or device cannot verify it',async t=>{
 const host=browser(t);await playBillingView(host,{esc,api:async()=>({ready:false,purchase_enabled:false,balance:2,joe_balance:0})});assert.equal(host.querySelector('[data-buy]'),null);
 await playBillingView(host,{esc,api:async()=>({ready:true,purchase_enabled:true,balance:2,joe_balance:0,packs:[]})});assert.equal(host.querySelector('[data-buy]'),null);assert.match(host.textContent,/latest ContractorSight app/);
});

test('monthly checkout waits for eligibility, retries safely, and opens only on a second click',async t=>{
 const host=browser(t);let fail=true,finish,opened=0,preparing=false,checks=0;
 const product={itemId:'contractorsight_pro',title:'Pro',price:{currency:'USD',value:'39.00'}};
 window.getDigitalGoodsService=async()=>({getDetails:async()=>[product]});
 const old=globalThis.PaymentRequest;globalThis.PaymentRequest=class{
  show(...args){assert.equal(preparing,false);assert.equal(args.length,0);opened++;return Promise.reject(Object.assign(new Error(),{name:'AbortError'}));}
 };t.after(()=>{globalThis.PaymentRequest=old;});
 const api=async path=>{
  if(path.endsWith('/prepare')){checks++;preparing=true;await new Promise(r=>finish=r);preparing=false;if(fail)throw new Error('Cannot reach ContractorSight.');return {ready:true};}
  return {ready:true,purchase_enabled:true,balance:0,joe_balance:0,packs:[],plans:[{id:product.itemId,name:'Pro',interval:'month',seats:1,analyses:75,joe_answers:100}]};
 };
 await playBillingView(host,{api,esc});const button=host.querySelector('[data-buy]');
 let pending=button.onclick();assert.equal(button.disabled,true);assert.equal(opened,0);
 await button.onclick();assert.equal(checks,1);finish();await pending;
 assert.match(host.textContent,/no payment was started/);assert.equal(opened,0);assert.equal(button.disabled,false);
 fail=false;pending=button.onclick();finish();await pending;assert.equal(opened,0);
 assert.equal(button.textContent,'Continue in Google Play');await button.onclick();assert.equal(opened,1);assert.equal(checks,2);
 assert.match(host.textContent,/Purchase canceled/);assert.equal(button.textContent,'Subscribe to Pro');
});

test('payment status check displays progress and a persistent completion message',async t=>{
 const host=browser(t),previous=globalThis.sessionStorage;globalThis.sessionStorage=window.sessionStorage;t.after(()=>{if(previous===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=previous;});
 let finish,checks=0;const api=async path=>{if(path==='/api/billing/sync'){checks++;await new Promise(resolve=>finish=resolve);return {}; }return {mode:'stripe-live',currency:'USD',balance:0,joe_balance:0,subscriptions:[],packs:[],checkout_enabled:true};};
 await billingView(host,{api,esc});const button=host.querySelector('[data-sync]'),pending=button.onclick();
 assert.equal(button.disabled,true);assert.equal(button.textContent,'Checking payment…');finish();await pending;
 assert.equal(checks,1);assert.match(host.querySelector('#billing-message').textContent,/Payment check complete/);assert.equal(host.querySelector('[data-sync]').disabled,false);
});

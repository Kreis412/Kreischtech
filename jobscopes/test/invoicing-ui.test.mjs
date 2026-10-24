import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {invoicePage} from '../public/invoicing.js';
import {projectPaymentsView} from '../public/project-payments.js';
function browser(t){const dom=new JSDOM('<body data-role="Owner"><main></main></body>',{url:'https://example.test/invoicing.html'});for(const name of ['window','document','location','FormData']){const previous=globalThis[name];globalThis[name]=dom.window[name];t.after(()=>{if(previous===undefined)delete globalThis[name];else globalThis[name]=previous;});}t.after(()=>dom.window.close());return document.querySelector('main');}
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const invoice={id:'c9c1b27a-f34c-4adc-a725-de7d96881809',project_id:'p',status:'draft',complete:true,url:null,amount_due:10000,amount_paid:0,currency:'usd',sent:false,customer_name:'<img src=x onerror=alert(1)>',items:[{description:'<script>attack()</script>',quantity:1,unit_amount:10000}]};
test('invoice UI escapes saved data and requires explicit finalize/send actions',async t=>{
 const host=browser(t),calls=[];let current={...invoice};
 const api=async(path,opts)=>{calls.push({path,opts});if(path==='/api/connect/status')return {enabled:true,mode:'sandbox',owner:true,active:true};if(path==='/api/projects')return [{id:'p',name:'Deck'}];if(!opts)return {invoices:[current]};if(path.endsWith('/finalize'))current={...current,status:'open',url:'https://invoice.stripe.com/i/test'};if(path.endsWith('/send'))current={...current,sent:true};return current;};
 await invoicePage(host,{api});assert.match(host.textContent,/Sandbox: test invoices only/);assert.equal(host.querySelector('img'),null);assert.equal(host.querySelector('script'),null);assert.match(host.textContent,/<script>attack/);
 assert.equal(calls.filter(c=>c.opts).length,0);assert.equal(host.querySelector('[data-action=send]'),null);
 host.querySelector('[data-action=finalize]').click();await turn();assert.equal(host.querySelector('input[readonly]').value,current.url);assert.ok(host.querySelector('[data-action=send]'));
 host.querySelector('[data-action=send]').click();await turn();assert.equal(host.querySelector('[data-action=send]'),null);assert.equal(calls.filter(c=>c.path.endsWith('/send')).length,1);
});
test('interrupted draft retries exactly the same payload and exposes persisted draft recovery',async t=>{
 const host=browser(t),bodies=[];let fails=true;
 const api=async(path,opts)=>{if(path==='/api/connect/status')return {enabled:true,mode:'sandbox',owner:true,active:true};if(path==='/api/projects')return [{id:'p',name:'Deck'}];if(path==='/api/connect/invoices'&&opts){bodies.push(JSON.parse(opts.body));if(fails)throw new Error('Network interrupted');return invoice;}return {invoices:[{...invoice,complete:false,status:'preparing'}]};};
 await invoicePage(host,{api});assert.ok(host.querySelector('[data-action=resume]'));
 const form=host.querySelector('form');form.querySelector('[name=customer_name]').value='Test Customer';form.querySelector('[name=customer_email]').value='test@example.test';form.querySelector('[name=description]').value='Deposit';form.querySelector('[name=price]').value='100.00';
 await form.onsubmit({preventDefault(){}});assert.match(host.textContent,/Retry same draft/);assert.equal(form.querySelector('[name=customer_name]').disabled,true);
 fails=false;await form.onsubmit({preventDefault(){}});assert.deepEqual(bodies[0],bodies[1]);assert.equal(bodies[0].items[0].unit_amount,10000);assert.match(host.textContent,/Draft created/);
});
test('manager can view but cannot create or send invoices; unconfigured invoicing is explicit',async t=>{
 const host=browser(t);
 await invoicePage(host,{api:async path=>path.endsWith('/status')?{enabled:true,mode:'sandbox',owner:false,active:true}:{invoices:[invoice]}});
 assert.equal(host.querySelector('form'),null);assert.equal(host.querySelector('[data-action]'),null);assert.equal(host.querySelector('#stripe-onboard'),null);
 await invoicePage(host,{api:async()=>({enabled:false,message:'Not configured yet.'})});assert.match(host.textContent,/Not configured yet/);
});
test('recorded project payments remain usable when Stripe status fails',async t=>{
 const host=browser(t);await projectPaymentsView(host,{id:'p',name:'Deck'},{api:async path=>{if(path==='/api/connect/status')throw new Error('Stripe down');return {total_cents:20000,received_cents:10000,balance_cents:10000,entries:[],today:'2026-10-24'};},write:async()=>{},esc:String,field:()=>'',openForm(){},toast(){}});
 assert.ok(host.querySelector('[data-payment-add]'));assert.match(host.textContent,/Record payment/);assert.match(host.textContent,/\$100.00/);
});
test('a pending Stripe status request does not delay recorded payment controls',async t=>{
 const host=browser(t);let finish;
 await projectPaymentsView(host,{id:'p',name:'Deck'},{api:async path=>path==='/api/connect/status'?new Promise(resolve=>finish=resolve):{total_cents:null,received_cents:0,balance_cents:null,entries:[],today:'2026-10-24'},write:async()=>{},esc:String,field:()=>'',openForm(){},toast(){}});
 assert.ok(host.querySelector('[data-payment-add]'));finish({enabled:true});await turn();assert.ok(host.querySelector('a[href="/invoicing.html"]'));
});

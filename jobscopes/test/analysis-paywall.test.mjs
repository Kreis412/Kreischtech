import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {showAnalysisPaywall} from '../public/analysis-paywall.js';
function browser(t){const dom=new JSDOM('<body></body>');const old=globalThis.document;globalThis.document=dom.window.document;dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};t.after(()=>{globalThis.document=old;dom.window.close();});}
test('active subscriptions and purchased pack credits suppress starter upsell',async t=>{browser(t);for(const b of [{subscriptions:[{status:'active'}]},{carryover_balance:5}]){assert.equal(await showAnalysisPaywall({api:async()=>b}),false);assert.equal(document.querySelector('dialog'),null);}});
test('exhausted allowance offers existing pricing without taking away saved work',async t=>{browser(t);await showAnalysisPaywall({api:async()=>({}),exhausted:true});assert.ok(document.querySelector('dialog').open);assert.equal(document.querySelector('[data-view-plans]').getAttribute('href'),'#settings/billing/plans');assert.equal(document.querySelector('[data-offer=packs]').getAttribute('href'),'#settings/billing/packs');document.querySelector('[data-close]').click();assert.equal(document.querySelector('dialog'),null);});
test('billing outage cannot stop successful analysis completion',async t=>{browser(t);assert.equal(await showAnalysisPaywall({api:async()=>{throw Error('offline');}}),false);});

test('Joe limit points directly to plans with answers',async t=>{browser(t);await showAnalysisPaywall({api:async()=>({}),exhausted:true,kind:'joe'});assert.equal(document.querySelector('[data-offer=packs]'),null);assert.equal(document.querySelector('[data-view-plans]').getAttribute('href'),'#settings/billing/plans');});

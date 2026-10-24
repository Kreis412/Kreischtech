import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderSettingsSection} from '../public/settings-navigation.js';
import {billingView} from '../public/billing.js';
import {playBillingView} from '../public/play-billing.js';
import {analyticsSettings} from '../public/analytics.js';
function browser(t){const dom=new JSDOM('<main></main>',{url:'https://example.test/#settings'});for(const key of ['window','document','location','localStorage','sessionStorage']){const old=globalThis[key];globalThis[key]=dom.window[key];t.after(()=>{if(old===undefined)delete globalThis[key];else globalThis[key]=old;});}t.after(()=>dom.window.close());return document.querySelector('main');}
const esc=value=>String(value??'').replaceAll('<','&lt;');
const navigation=()=>'<nav class="settings-nav" aria-label="Settings sections"><a href="'+location.hash+'" aria-current="page">Current settings</a></nav>';
const billing={mode:'stripe-live',currency:'USD',balance:21,joe_balance:15,subscriptions:[],plans:[],packs:[],checkout_enabled:false};
const mount=(host,render)=>renderSettingsSection(host,{render,navigation});
function check(host,route){assert.equal(host.querySelectorAll('.settings-nav').length,1);assert.equal(host.querySelector('.settings-nav [aria-current=page]').getAttribute('href'),route);assert.equal(host.querySelector('[data-settings-content] .settings-nav'),null);}
test('switching through real billing, Play and append-only privacy sections never stacks settings rows',async t=>{
 const host=browser(t);await mount(host,section=>{section.innerHTML='<h1>Company and team</h1>';});check(host,'#settings');
 for(let i=0;i<3;i++){
  location.hash='#settings/billing';await mount(host,section=>billingView(section,{api:async()=>billing,esc}));check(host,location.hash);
  const billingSection=host.querySelector('[data-settings-content]');await billingView(billingSection,{api:async()=>billing,esc});check(host,location.hash);assert.equal(host.querySelectorAll('h1').length,1);
  location.hash='#settings/privacy';await mount(host,section=>analyticsSettings(section));check(host,location.hash);assert.match(host.textContent,/Optional usage analytics/);assert.doesNotMatch(host.textContent,/Monthly plans/);
  location.hash='#settings/billing';await mount(host,section=>playBillingView(section,{api:async()=>({ready:false,purchase_enabled:false,balance:21,joe_balance:15,packs:[]}),esc}));check(host,location.hash);
  await playBillingView(host.querySelector('[data-settings-content]'),{api:async()=>({ready:false,purchase_enabled:false,balance:21,joe_balance:15,packs:[]}),esc});check(host,location.hash);
 }
});
test('saving or replacing a section cannot remove or duplicate the shared settings navigation',async t=>{
 const host=browser(t);location.hash='#settings/expertise';await mount(host,section=>{section.innerHTML='<form><input name="profession"><button>Save</button></form>';section.querySelector('form').onsubmit=e=>{e.preventDefault();section.innerHTML='<p>Profession saved.</p>';};});host.querySelector('form').dispatchEvent(new window.Event('submit',{cancelable:true}));check(host,location.hash);assert.match(host.textContent,/Profession saved/);
 location.hash='#settings/appearance';await mount(host,section=>{section.innerHTML='<h1>Appearance</h1>';});check(host,location.hash);assert.doesNotMatch(host.textContent,/Profession saved/);
});
test('a slow previous settings request cannot overwrite the newly selected section',async t=>{
 const host=browser(t);let finish,current='billing';const old=renderSettingsSection(host,{render:async section=>{await new Promise(r=>finish=r);section.innerHTML='<h1>Stale billing</h1>';},navigation,isCurrent:()=>current==='billing'});
 current='privacy';location.hash='#settings/privacy';await mount(host,section=>{section.innerHTML='<h1>Current privacy</h1>';});finish();await old;check(host,location.hash);assert.match(host.textContent,/Current privacy/);assert.doesNotMatch(host.textContent,/Stale billing/);
});

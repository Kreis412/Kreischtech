import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {calculators,calculate,calculatorsView} from '../public/calculators.js';
const values=id=>Object.fromEntries(calculators[id].fields.map(f=>[f.key,f.value]));
test('material quantities and waste conversions',()=>{
 assert.equal(calculate('aggregate',{...values('aggregate'),length:27,width:12,depth:1,extra:0,density:2000})[0][1],1);
 assert.equal(calculate('aggregate',{...values('aggregate'),length:27,width:12,depth:1,extra:10,density:2000})[2][1],1.1);
 assert.equal(calculate('concrete',{...values('concrete'),length:3,width:3,depth:36,extra:0,yield:1})[0][1],1);
 assert.equal(calculate('framing',{...values('framing'),length:16,height:8,extra:0})[0][1],13);
 assert.equal(calculate('framing',{...values('framing'),length:16,height:8,extra:0})[2][1],8);
 assert.equal(calculate('roof',{...values('roof'),length:10,width:10,rise:0,extra:0,coverage:25})[4][1],4);
 assert.equal(calculate('paint',{...values('paint'),area:350,coats:2,extra:0})[0][1],2);
 assert.equal(calculate('flooring',values('flooring'))[2][1],7);
 assert.equal(calculate('hvac',{area:1000,factor:24})[1][1],2);
});
test('voltage drop includes round-trip length and searches gauges',()=>{
 const r=calculate('electrical',values('electrical'));assert.ok(Math.abs(r[0][1]-5.926493)<.00001);assert.equal(r[3][1],'8 AWG');assert.match(r[4][1],/No/);
 assert.ok(calculate('electrical',{...values('electrical'),metal:'Aluminum'})[0][1]>r[0][1]);
});
test('invalid inputs never produce a plausible result',()=>{
 for(const id of Object.keys(calculators)){assert.throws(()=>calculate(id,{...values(id),[calculators[id].fields[0].key]:''}));assert.throws(()=>calculate(id,{...values(id),[calculators[id].fields[0].key]:-1}));}
 assert.throws(()=>calculate('framing',{...values('framing'),openings:1000}));assert.throws(()=>calculate('hvac',values('hvac')));assert.throws(()=>calculate('electrical',{...values('electrical'),gauge:'invalid'}));
});
test('calculator UI calculates, invalidates stale results, switches and resets',()=>{
 const dom=new JSDOM('<main></main>');global.document=dom.window.document;global.FormData=dom.window.FormData;
 try{const host=document.querySelector('main');calculatorsView(host);let form=host.querySelector('form');form.dispatchEvent(new dom.window.Event('submit',{cancelable:true}));assert.match(host.querySelector('[role=status]').textContent,/Order volume/);
 form.elements.namedItem('length').value='30';form.dispatchEvent(new dom.window.Event('input'));assert.match(host.querySelector('[role=status]').textContent,/Inputs changed/);
 const choice=host.querySelector('#calculator-choice');choice.value='roof';choice.dispatchEvent(new dom.window.Event('change'));assert.match(host.querySelector('h2').textContent,/Roof/);
 choice.value='aggregate';choice.dispatchEvent(new dom.window.Event('change'));form=host.querySelector('form');assert.equal(form.elements.namedItem('length').value,'30');form.dispatchEvent(new dom.window.Event('reset',{cancelable:true}));assert.equal(host.querySelector('form').elements.namedItem('length').value,'20');
 }finally{delete global.document;delete global.FormData;dom.window.close();}
});

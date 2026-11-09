import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {equipmentUI} from '../public/equipment.js';
test('fleet scan button opens imports and consent form with vehicle context',async()=>{
 const dom=new JSDOM('<main></main>');const host=dom.window.document.querySelector('main');let form;
 const asset={id:'truck',name:'Silverado',make_model:'Chevrolet Silverado',history:[],reading:null,service_meter:null};
 const ui=equipmentUI({api:async path=>path.endsWith('/scans')?{photos:[{id:'scan',mime:'image/png',created_at:new Date().toISOString()}]}:path==='/api/projects'?[]:{assets:[asset],canEdit:true},write:async()=>{},esc:v=>String(v??'').replaceAll('<','&lt;').replaceAll('"','&quot;'),field:(label,name,value)=>`<label>${label}<input name="${name}" value="${value}"></label>`,selectField:()=>'',openForm:(...args)=>{form=args;},toast:message=>{throw Error(message);}});
 await ui.mount(host);host.querySelector('[data-eq=scans]').click();await new Promise(resolve=>setTimeout(resolve,0));
 assert.match(host.textContent,/Import report or screenshot/);assert.match(host.querySelector('#scan-file').accept,/\.csv/);
 host.querySelector('[data-scan-analyze]').click();assert.match(form[2],/Chevrolet Silverado/);assert.match(form[2],/name="consent" required/);dom.window.close();
});

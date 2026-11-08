import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {operationsUI} from '../public/operations.js';
test('crew creation assigns to project, self entry is prefilled, and time uses hours',async t=>{
 const dom=new JSDOM('<body data-role="Owner"><main></main></body>');const previous=globalThis.document;globalThis.document=dom.window.document;t.after(()=>{globalThis.document=previous;dom.window.close();});
 const host=document.querySelector('main'),calls=[];let form;
 const state={today:'2026-01-01',crew:[],assignments:[],time:[],tasks:[],findings:[],reports:[],recovery:[],summary:{},cost:null};
 const ui=operationsUI({api:async path=>path==='/api/account/session'?{user:{name:'Robert'}}:path.endsWith('/analysis')?{runs:[]}:state,write:async(path,method,body)=>{calls.push({path,method,body});return {id:'crew-1'};},esc:x=>String(x??''),field:(label,name,value)=>`<label>${label}<input name="${name}" value="${value??''}"></label>`,selectField:()=>'',openForm:(...args)=>{form=args;},toast:()=>{}});
 await ui.mount(host,{id:'project-1',photos:[]});
 host.querySelector('[data-op="self"]').click();await new Promise(r=>setImmediate(r));assert.match(form[2],/value="Robert"/);
 await form[3]({name:'Robert',rate:'40',active:'Active'});assert.equal(calls[0].path,'/api/operations/crew');assert.equal(calls[1].path,'/api/projects/project-1/operations/assignments');assert.equal(calls[1].body.crew_id,'crew-1');
 host.querySelector('[data-op="time"]').click();assert.match(form[2],/name="hours"/);assert.doesNotMatch(form[2],/name="minutes"/);
 await form[3]({hours:'1.5',crew_id:'crew-1'});assert.equal(calls.at(-1).body.hours,'1.5');
});

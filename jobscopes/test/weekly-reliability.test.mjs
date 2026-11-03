import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {JSDOM} from 'jsdom';
import {materialUI} from '../public/materials.js';
import {createProduct} from '../server.mjs';

test('weekly regression: retry-safe notes, account isolation, atomic corrections and saved quotes',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'cs-weekly-'));let server,base;
 async function start(){server=createProduct({dataDir:dir});server.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+server.address().port;}
 await start();t.after(async()=>{if(server.listening)await new Promise(r=>server.close(r));rmSync(dir,{recursive:true,force:true});});
 let cookie='';async function call(path,method='GET',body,status=200,headers={}){const r=await fetch(base+path,{method,headers:{cookie,'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;}
 await call('/api/account/register','POST',{name:'Audit',email:'audit@example.test',company:'Audit',password:'Audit-only-56789!'},201);
 const identity=await call('/api/account/session');
 const p=await call('/api/projects','POST',{name:'Audit project',type:'Basement',status:'Planning'},201);
 const other=await call('/api/projects','POST',{name:'Other project',type:'Basement',status:'Planning'},201);
 const notes='/api/projects/'+p.id+'/discoveries',path='/api/projects/'+p.id+'/estimate';
 const n={client_note_id:'offline-one',title:'Site observation',description:'Keep this note',category:'General',priority:'Medium',status:'Open',next_step:'',photo_id:''};
 const headers={'X-Note-Company':identity.company.id,'X-Note-Owner':encodeURIComponent(identity.user.email)};
 const copies=await Promise.all([call(notes,'POST',n,201,headers),call(notes,'POST',n,201,headers)]);
 assert.equal(copies[0].id,copies[1].id);
 assert.equal((await call('/api/projects/'+p.id)).discoveries.length,1);
 await call(notes,'POST',{...n,description:'Changed'},409,headers);
 await call(notes,'POST',n,409,{...headers,'X-Note-Company':'wrong-company'});
 let state=await call(path+'/items','POST',{name:'Lumber',section:'General work',kind:'Material',unit:'each',quantity:10,waste:10,unit_price:2.5,status:'Included',price_source:'Supplier',price_date:'2026-11-02',notes:'Known size',remember_correction:'yes'},201);
 assert.equal(state.corrections.length,1);assert.equal(state.totals.total_cents,2750);
 const item=state.items[0];
 await call(path+'/items/'+item.id,'PUT',{...item,unit_price:null,remember_correction:'yes'},400);
 state=await call(path);assert.equal(state.items[0].revision,item.revision);assert.equal(state.items[0].unit_cents,250);assert.equal(state.corrections.length,1);
 state=await call(path+'/pricing','PUT',{markup:20,notes:'Overhead',revision:state.pricing.revision});
 await call(path+'/quotes','POST',{token:state.token,confirm_gaps:true,valid_until:'2026-02-30'},400);
 const quote=await call(path+'/quotes','POST',{token:state.token,confirm_gaps:true,valid_until:'2026-12-01'},201);
 assert.equal(quote.content.lines[0].waste,10);assert.equal(quote.content.selling_cents,3300);assert.equal(quote.content.markup_cents,550);
 await call('/api/projects/'+other.id+'/estimate/quotes/'+quote.id,'GET',undefined,404);

 const dom=new JSDOM('<main id="materials"></main><dialog id="editor"><form id="editor-form"></form></dialog>',{url:base});
 const previous={window:globalThis.window,document:globalThis.document};globalThis.window=dom.window;globalThis.document=dom.window.document;
 try{
  const dialog=document.querySelector('#editor'),form=document.querySelector('#editor-form');
  dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;setTimeout(()=>dialog.dispatchEvent(new dom.window.Event('close')),0);};
  const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const formCode=source.slice(source.indexOf('function openForm('),source.indexOf('function deleteProjectForm('));
  const openForm=new Function('form','dialog','esc','$','FormData','normalizeCurrency',formCode+';return openForm;')(form,dialog,s=>String(s),s=>document.querySelector(s),dom.window.FormData,s=>s);
  let writes=0,printed=0;dom.window.print=()=>printed++;
  const ui=materialUI({api:async()=>state,write:async()=>{writes++;return quote;},esc:s=>String(s),field:(label,name,value)=>'<input name="'+name+'" value="'+value+'">',selectField:()=>'',openForm,toast:()=>{},getProject:()=>p});
  const host=document.querySelector('#materials');await ui.mount(host,p);host.querySelector('[data-material="quote"]').click();
  await form.onsubmit({preventDefault(){}});await new Promise(r=>setTimeout(r,10));
  assert.equal(writes,1);assert.equal(dialog.open,true);assert.equal(dialog.classList.contains('customer-quote'),true);
  assert.match(form.textContent,/Quoted total: \$33.00/);assert.match(form.textContent,/10% waste/);assert.match(form.textContent,/overhead & profit/);
  form.querySelector('.dialog-actions button').click();assert.equal(printed,1);assert.equal(document.querySelector('style'),null);
 }finally{globalThis.window=previous.window;globalThis.document=previous.document;dom.window.close();}
 await new Promise(r=>server.close(r));await start();
 assert.equal((await call(path+'/quotes/'+quote.id)).content.selling_cents,3300);
 assert.equal((await call(notes,'POST',n,201,headers)).id,copies[0].id);
 await call('/api/projects/'+p.id,'DELETE',{confirm_name:p.name,revision:p.revision});
 const otherState=await call('/api/projects/'+other.id+'/estimate');assert.equal(otherState.corrections.length,1);
 await call(path+'/quotes/'+quote.id,'GET',undefined,404);
});

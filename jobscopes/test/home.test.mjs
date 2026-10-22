import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {homeOverview,photoProjectPicker} from '../public/home.js';
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const project={id:'a',name:'Kitchen',status:'Planning',photo_count:0,open_count:0,updated_at:'2026-01-01'};
test('home prioritizes capture, escapes business names, shows real next steps and respects viewer role',()=>{
 const html=homeOverview({projects:[project],session:{company:{name:'<img onerror=bad>'}},role:'Owner',esc});
 assert.ok(html.indexOf('data-action="home-photo"')<html.indexOf('More ways'));
 assert.match(html,/&lt;img/);assert.match(html,/Add your first site photo/);assert.match(html,/#settings\/expertise/);
 const viewer=homeOverview({projects:[],role:'Viewer',esc});assert.doesNotMatch(viewer,/data-action="home-photo"|#company|#settings\/profile|#appointments/);
});
test('project picker ignores stale loads and opens camera from a fresh click without uploading or analyzing',async t=>{
 const dom=new JSDOM('<body></body>');const old=globalThis.document;globalThis.document=dom.window.document;t.after(()=>{globalThis.document=old;dom.window.close();});
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
 const pending={},opened=[];const dialog=photoProjectPicker({projects:[project,{...project,id:'b'}],api:path=>new Promise(resolve=>pending[path]=resolve),esc,onNew(){},onOpen:(...a)=>opened.push(a)});
 assert.equal(dialog.querySelector('[data-mode=camera]').disabled,true);
 dialog.querySelector('select').value='b';dialog.querySelector('select').onchange();
 pending['/api/projects/b']({id:'b',photos:[]});await new Promise(r=>setImmediate(r));
 pending['/api/projects/a']({id:'a',photos:[{}]});await new Promise(r=>setImmediate(r));
 assert.equal(dialog.querySelector('[data-mode=analyze]').disabled,true);assert.equal(opened.length,0);
 dialog.querySelector('[data-mode=camera]').click();assert.equal(opened[0][0].id,'b');assert.equal(opened[0][1],'camera');assert.equal(dialog.isConnected,false);
});

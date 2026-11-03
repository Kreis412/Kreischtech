import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {JSDOM} from 'jsdom';
import {fieldNotes,fieldNoteStorage} from '../public/field-notes.js';

test('field notes survive offline remounts and failed responses without switching account ownership',async t=>{
 const dom=new JSDOM('<div id="notes"></div>',{url:'https://example.test'});
 const old={window:globalThis.window,navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),indexedDB:globalThis.indexedDB};
 globalThis.window=dom.window;globalThis.indexedDB=new IDBFactory();Object.defineProperty(globalThis,'navigator',{value:{onLine:false,language:'en-US'},configurable:true});
 t.after(()=>{fieldNotes.unmount();dom.window.close();globalThis.window=old.window;globalThis.indexedDB=old.indexedDB;if(old.navigator)Object.defineProperty(globalThis,'navigator',old.navigator);else delete globalThis.navigator;});
 let identity={user:{email:'owner@example.test'},company:{id:'company-a',role:'Owner'}},fail=true,sent=[],saved=[];
 fieldNotes.configure({getIdentity:()=>identity,api:async(path,options)=>{sent.push(JSON.parse(options.body));if(fail)throw Error('Response lost');return{id:'server-note'};},onSynced:(n,s)=>saved.push(s)});
 const host=dom.window.document.querySelector('#notes'),options={getIdentity:()=>identity,esc:s=>s,toast:()=>{}};
 fieldNotes.mount(host,{id:'project-a'},options);host.querySelector('textarea').value='Measure the door';
 const button=host.querySelector('[data-field-note="save"]');await host.onclick({target:button});
 assert.equal((await fieldNoteStorage.all()).length,1);assert.equal(sent.length,0);
 fieldNotes.unmount();fieldNotes.mount(host,{id:'project-a'},options);
 navigator.onLine=true;await fieldNotes.sync();assert.equal((await fieldNoteStorage.all())[0].lastError,'Response lost');
 identity={user:{email:'other@example.test'},company:{id:'company-b',role:'Owner'}};await fieldNotes.sync();assert.equal(sent.length,1);
 identity={user:{email:'owner@example.test'},company:{id:'company-a',role:'Owner'}};fail=false;await Promise.all([fieldNotes.sync(),fieldNotes.sync()]);
 assert.equal(sent.length,2);assert.equal(sent[0].client_note_id,sent[1].client_note_id);assert.equal((await fieldNoteStorage.all()).length,0);assert.equal(saved.length,1);
 identity.company.role='Viewer';fieldNotes.mount(host,{id:'project-a'},options);assert.match(host.textContent,/read-only/);assert.equal(host.querySelector('textarea'),null);
});

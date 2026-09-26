import {test} from 'node:test';
import assert from 'node:assert/strict';
import {operationsUI} from '../public/operations.js';
test('blueprint action opens consent form despite a cached site review and submits blueprint mode',async()=>{
 globalThis.document={body:{dataset:{role:'Owner'}}};let form,written,complete=0;
 const ui=operationsUI({api:async()=>({model:'gpt-6-astra',cloud:{remaining_attempts:1,limit_usd:2},runs:[{photo_id:'p',model:'gpt-6-astra',mode:'site'}]}),write:async(url,method,body)=>{written=body;return {count:1};},esc:String,field:()=>'',selectField:()=>'',openForm:(...args)=>form=args,toast:()=>{}});
 try{await ui.analyzePhoto({id:'project',photos:[{id:'p',name:'Sheet A1'}]},'p',async()=>complete++,'blueprint');assert.equal(form[0],'Analyze blueprint');assert.match(form[2],/cloud_consent/);assert.match(form[2],/PDFs are not supported/);assert.equal(written,undefined);await form[3]({photo_id:'p',context:'Check dimensions',cloud_consent:'on'});assert.equal(written.mode,'blueprint');assert.equal(written.cloud_consent,true);assert.equal(complete,1);}finally{delete globalThis.document;}
});
